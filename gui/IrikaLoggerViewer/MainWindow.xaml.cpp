#include "pch.h"
#include "MainWindow.xaml.h"
#if __has_include("MainWindow.g.cpp")
#include "MainWindow.g.cpp"
#include <winrt/Microsoft.UI.Interop.h>
#include <winrt/Windows.Storage.Pickers.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.System.h>
#include <winrt/Windows.System.Threading.h>
#include <winrt/Microsoft.UI.Dispatching.h>
#include <winrt/Microsoft.UI.Xaml.Controls.Primitives.h>
#include <fstream>
#include <string>
#include <cwctype>
#include <algorithm>
#include "json.hpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::IrikaLoggerViewer::implementation
{
    MainWindow::MainWindow()
    {
        try {
            m_logItems = winrt::single_threaded_observable_vector<IrikaLoggerViewer::LogItem>();
            m_logSettings = winrt::make<IrikaLoggerViewer::implementation::LogSettings>();
            
            InitializeComponent();
            
            LogListView().ItemsSource(m_logItems);
            LogListView().Header(m_logSettings);

            this->Title(L"Irika System Logger Viewer");
        } catch (winrt::hresult_error const& ex) {
            std::wofstream ofs(L"crash.log");
            ofs << L"Crash in MainWindow constructor: " << ex.message().c_str() << std::endl;
            ofs.close();
            throw;
        } catch (std::exception const& ex) {
            std::ofstream ofs("crash_std.log");
            ofs << "Standard Exception: " << ex.what() << std::endl;
            ofs.close();
            throw;
        } catch (...) {
            std::ofstream ofs("crash_unknown.log");
            ofs << "Unknown Exception" << std::endl;
            ofs.close();
            throw;
        }
    }

    winrt::Windows::Foundation::Collections::IObservableVector<IrikaLoggerViewer::LogItem> MainWindow::LogItems()
    {
        return m_logItems;
    }

    winrt::fire_and_forget MainWindow::OpenFile_Click(winrt::Windows::Foundation::IInspectable const& /*sender*/, winrt::Microsoft::UI::Xaml::RoutedEventArgs const& /*args*/)
    {
        auto windowNative = this->try_as<IWindowNative>();
        if (!windowNative) co_return;

        HWND hwnd{ 0 };
        windowNative->get_WindowHandle(&hwnd);

        winrt::Windows::Storage::Pickers::FileOpenPicker picker;
        auto initializeWithWindow = picker.try_as<::IInitializeWithWindow>();
        initializeWithWindow->Initialize(hwnd);

        picker.ViewMode(winrt::Windows::Storage::Pickers::PickerViewMode::List);
        picker.SuggestedStartLocation(winrt::Windows::Storage::Pickers::PickerLocationId::DocumentsLibrary);
        picker.FileTypeFilter().Append(L".log");
        picker.FileTypeFilter().Append(L".jsonl");
        picker.FileTypeFilter().Append(L".txt");
        picker.FileTypeFilter().Append(L"*");

        auto file = co_await picker.PickSingleFileAsync();
        if (file)
        {
            m_monitorSessionId++; // Stop old threads immediately
            m_currentFilePath = file.Path().c_str();
            
            m_allLogItems.clear();
            m_allLogItems.shrink_to_fit();
            m_logItems.Clear();
            m_lastReadPosition = 0;

            StartFileMonitor();
        }
    }

    void MainWindow::Clear_Click(winrt::Windows::Foundation::IInspectable const& /*sender*/, winrt::Microsoft::UI::Xaml::RoutedEventArgs const& /*args*/)
    {
        m_monitorSessionId++;
        m_currentFilePath = L"";
        
        m_allLogItems.clear();
        m_allLogItems.shrink_to_fit();
        m_logItems.Clear();
    }

    void MainWindow::SearchBox_TextChanged(winrt::Windows::Foundation::IInspectable const& /*sender*/, winrt::Microsoft::UI::Xaml::Controls::TextChangedEventArgs const& /*args*/)
    {
        ApplyFilter();
    }

    void MainWindow::LevelFilter_SelectionChanged(winrt::Windows::Foundation::IInspectable const& /*sender*/, winrt::Microsoft::UI::Xaml::Controls::SelectionChangedEventArgs const& /*args*/)
    {
        ApplyFilter();
    }

    void MainWindow::Thumb_DragDelta(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::Controls::Primitives::DragDeltaEventArgs const& args)
    {
        auto thumb = sender.as<Primitives::Thumb>();
        hstring tag = unbox_value<hstring>(thumb.Tag());
        double change = args.HorizontalChange();

        if (tag == L"Time") {
            double newWidth = (std::max)(50.0, m_logSettings.ColTimeWidth() + change);
            m_logSettings.ColTimeWidth(newWidth);
        } else if (tag == L"Level") {
            double newWidth = (std::max)(30.0, m_logSettings.ColLevelWidth() + change);
            m_logSettings.ColLevelWidth(newWidth);
        } else if (tag == L"Module") {
            double newWidth = (std::max)(50.0, m_logSettings.ColModuleWidth() + change);
            m_logSettings.ColModuleWidth(newWidth);
        } else if (tag == L"Message") {
            double newWidth = (std::max)(100.0, m_logSettings.ColMessageWidth() + change);
            m_logSettings.ColMessageWidth(newWidth);
        }
    }

    void MainWindow::LogListView_ContainerContentChanging(winrt::Microsoft::UI::Xaml::Controls::ListViewBase const& /*sender*/, winrt::Microsoft::UI::Xaml::Controls::ContainerContentChangingEventArgs const& /*args*/)
    {
        // For performance if needed
    }

    void MainWindow::ApplyFilter()
    {
        if (!m_logItems || !SearchBox() || !LevelFilter()) return;

        hstring searchText = SearchBox().Text();
        std::wstring searchLower;
        for (wchar_t c : searchText) searchLower += std::towlower(c);

        int levelIdx = LevelFilter().SelectedIndex();
        // 0: All, 1: info, 2: warn, 3: error, 4: debug
        std::wstring targetLevel;
        if (levelIdx == 1) targetLevel = L"info";
        else if (levelIdx == 2) targetLevel = L"warn";
        else if (levelIdx == 3) targetLevel = L"error";
        else if (levelIdx == 4) targetLevel = L"debug";

        m_logItems.Clear();
        for (auto const& item : m_allLogItems)
        {
            // Level filter
            if (!targetLevel.empty()) {
                std::wstring itemLvl = item.Level().c_str();
                std::wstring itemLvlLower;
                for (wchar_t c : itemLvl) itemLvlLower += std::towlower(c);
                if (itemLvlLower != targetLevel) continue;
            }

            // Text search
            if (!searchLower.empty()) {
                std::wstring msg = item.LogMessage().c_str();
                std::wstring msgLower;
                for (wchar_t c : msg) msgLower += std::towlower(c);

                if (msgLower.find(searchLower) == std::wstring::npos) {
                    continue;
                }
            }

            m_logItems.Append(item);
        }
    }

    void MainWindow::ExpandToggle_Click(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::RoutedEventArgs const& /*args*/)
    {
        if (auto btn = sender.as<winrt::Microsoft::UI::Xaml::Controls::Primitives::ToggleButton>())
        {
            if (auto item = btn.DataContext().try_as<IrikaLoggerViewer::implementation::LogItem>())
            {
                item->ToggleExpand();
            }
        }
    }

    void MainWindow::Grid_DoubleTapped(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::Input::DoubleTappedRoutedEventArgs const& /*args*/)
    {
        if (auto grid = sender.as<winrt::Microsoft::UI::Xaml::Controls::Grid>())
        {
            if (auto item = grid.DataContext().try_as<IrikaLoggerViewer::implementation::LogItem>())
            {
                item->ToggleExpand();
            }
        }
    }

    void MainWindow::StartFileMonitor()
    {
        int currentSession = ++m_monitorSessionId;
        auto dispatcher = Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread();

        winrt::Windows::System::Threading::ThreadPool::RunAsync([=](auto const&) {
            while (m_monitorSessionId == currentSession)
            {
                if (m_currentFilePath.empty()) break;

                std::ifstream ifs(m_currentFilePath, std::ios::binary | std::ios::ate);
                if (!ifs) {
                    Sleep(1000);
                    continue;
                }

                uint64_t currentSize = ifs.tellg();
                if (currentSize > m_lastReadPosition)
                {
                    ifs.seekg(m_lastReadPosition);
                    std::string line;
                    std::vector<IrikaLoggerViewer::LogItem> newItems;

                    while (std::getline(ifs, line))
                    {
                        if (line.empty()) continue;
                        try {
                            auto j = nlohmann::json::parse(line);
                            if (j.value("type", "") == "EOF") continue;

                            winrt::hstring ts = winrt::to_hstring(j.value("ts", ""));
                            winrt::hstring lvl = winrt::to_hstring(j.value("lvl", ""));
                            winrt::hstring mod = winrt::to_hstring(j.value("mod", ""));
                            winrt::hstring msg = winrt::to_hstring(j.value("msg", ""));
                            winrt::hstring traceId = winrt::to_hstring(j.value("traceId", ""));
                            
                            std::string ctxStr = "";
                            if (j.contains("ctx") && !j["ctx"].is_null()) {
                                ctxStr = j["ctx"].dump();
                            }
                            winrt::hstring ctx = winrt::to_hstring(ctxStr);

                            auto item = winrt::make<IrikaLoggerViewer::implementation::LogItem>(ts, lvl, mod, msg, traceId, ctx, m_logSettings);
                            newItems.push_back(item);
                        } catch (...) {
                            // ignore malformed lines
                        }
                    }

                    m_lastReadPosition = ifs.tellg();

                    dispatcher.TryEnqueue([this, newItems = std::move(newItems)]() {
                        for (auto const& item : newItems) {
                            m_allLogItems.push_back(item);
                        }
                        ApplyFilter();

                        // Auto-scroll logic
                        if (AutoTailToggle().IsChecked().GetBoolean()) {
                            if (m_logItems.Size() > 0) {
                                LogListView().ScrollIntoView(m_logItems.GetAt(m_logItems.Size() - 1));
                            }
                        }
                    });
                }
                
                Sleep(500); // Poll every 500ms
            }
        });
    }
}
