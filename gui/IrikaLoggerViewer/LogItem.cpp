#include "pch.h"
#include "LogItem.h"
#include "LogItem.g.cpp"
#include <winrt/Windows.UI.h>
#include <cwctype>
#include <string>

namespace winrt::IrikaLoggerViewer::implementation
{
    LogItem::LogItem(hstring const& timestamp, hstring const& level, hstring const& modName, hstring const& logMsg, hstring const& traceId, hstring const& ctx, IrikaLoggerViewer::LogSettings const& settings)
        : m_timestamp(timestamp), m_level(level), m_module(modName), m_message(logMsg), m_traceId(traceId), m_context(ctx), m_settings(settings)
    {
        std::wstring lvlLower;
        for (wchar_t c : level) lvlLower += std::towlower(c);

        winrt::Windows::UI::Color c;
        if (lvlLower == L"error" || lvlLower == L"fatal") {
            c = winrt::Microsoft::UI::Colors::Red();
        } else if (lvlLower == L"warn" || lvlLower == L"warning") {
            c = winrt::Microsoft::UI::Colors::Orange();
        } else if (lvlLower == L"debug") {
            c = winrt::Microsoft::UI::Colors::LightBlue();
        } else {
            c = winrt::Microsoft::UI::Colors::White(); // Or fallback to theme default if possible, but White is requested. Let's use standard colors.
            // Actually, returning nullptr for standard text color is best for Light/Dark mode!
        }
        
        if (lvlLower == L"error" || lvlLower == L"fatal" || lvlLower == L"warn" || lvlLower == L"warning" || lvlLower == L"debug") {
            m_levelColor = winrt::Microsoft::UI::Xaml::Media::SolidColorBrush(c);
        } else {
            // Nullptr means fallback to default Foreground color of TextBlock
            m_levelColor = nullptr;
        }
    }

    hstring LogItem::Timestamp() { return m_timestamp; }
    hstring LogItem::Level() { return m_level; }
    hstring LogItem::ModuleName() { return m_module; }
    hstring LogItem::LogMessage() { return m_message; }
    hstring LogItem::TraceId() { return m_traceId; }
    hstring LogItem::Context() { return m_context; }
    IrikaLoggerViewer::LogSettings LogItem::Settings() { return m_settings; }

    bool LogItem::IsExpanded() { return m_isExpanded; }
    void LogItem::ToggleExpand()
    {
        m_isExpanded = !m_isExpanded;
        RaisePropertyChanged(L"IsExpanded");
        RaisePropertyChanged(L"DetailVisibility");
    }

    winrt::Microsoft::UI::Xaml::Visibility LogItem::DetailVisibility()
    {
        return m_isExpanded ? winrt::Microsoft::UI::Xaml::Visibility::Visible : winrt::Microsoft::UI::Xaml::Visibility::Collapsed;
    }

    winrt::Microsoft::UI::Xaml::Media::Brush LogItem::LevelColor() { return m_levelColor; }

    winrt::event_token LogItem::PropertyChanged(winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler const& handler)
    {
        return m_propertyChanged.add(handler);
    }

    void LogItem::PropertyChanged(winrt::event_token const& token) noexcept
    {
        m_propertyChanged.remove(token);
    }

    void LogItem::RaisePropertyChanged(hstring const& propertyName)
    {
        m_propertyChanged(*this, winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventArgs(propertyName));
    }
}
