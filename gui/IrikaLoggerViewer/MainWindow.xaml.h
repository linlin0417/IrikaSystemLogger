#pragma once
#include "MainWindow.g.h"
#include <winrt/Windows.Foundation.Collections.h>
#include "LogItem.h"
#include "LogSettings.h"
#include <vector>
#include <mutex>
#include <winrt/Microsoft.UI.Dispatching.h>

namespace winrt::IrikaLoggerViewer::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
    public:
        MainWindow();

        winrt::Windows::Foundation::Collections::IObservableVector<IrikaLoggerViewer::LogItem> LogItems();

        winrt::fire_and_forget OpenFile_Click(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::RoutedEventArgs const& args);
        void Clear_Click(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::RoutedEventArgs const& args);

        void SearchBox_TextChanged(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::Controls::TextChangedEventArgs const& args);
        void LevelFilter_SelectionChanged(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::Controls::SelectionChangedEventArgs const& args);
        void Thumb_DragDelta(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::Controls::Primitives::DragDeltaEventArgs const& args);
        void LogListView_ContainerContentChanging(winrt::Microsoft::UI::Xaml::Controls::ListViewBase const& sender, winrt::Microsoft::UI::Xaml::Controls::ContainerContentChangingEventArgs const& args);
        void ExpandToggle_Click(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::RoutedEventArgs const& args);
        void Grid_DoubleTapped(winrt::Windows::Foundation::IInspectable const& sender, winrt::Microsoft::UI::Xaml::Input::DoubleTappedRoutedEventArgs const& args);

    private:
        void ApplyFilter();
        void StartFileMonitor();

        winrt::Windows::Foundation::Collections::IObservableVector<IrikaLoggerViewer::LogItem> m_logItems;
        std::vector<IrikaLoggerViewer::LogItem> m_allLogItems;
        IrikaLoggerViewer::LogSettings m_logSettings{ nullptr };
        
        std::wstring m_currentFilePath;
        uint64_t m_lastReadPosition = 0;
        std::atomic<int> m_monitorSessionId{0};
    };
}

namespace winrt::IrikaLoggerViewer::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow>
    {
    };
}
