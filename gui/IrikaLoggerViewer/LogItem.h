#pragma once
#include "LogItem.g.h"
#include "LogSettings.h"
#include <winrt/Microsoft.UI.Xaml.Media.h>
#include <winrt/Microsoft.UI.Xaml.Data.h>

namespace winrt::IrikaLoggerViewer::implementation
{
    struct LogItem : LogItemT<LogItem>
    {
        LogItem() = default;
        LogItem(hstring const& timestamp, hstring const& level, hstring const& modName, hstring const& logMsg, hstring const& traceId, hstring const& ctx, IrikaLoggerViewer::LogSettings const& settings);

        hstring Timestamp();
        hstring Level();
        hstring ModuleName();
        hstring LogMessage();
        hstring TraceId();
        hstring Context();
        IrikaLoggerViewer::LogSettings Settings();

        bool IsExpanded();
        void ToggleExpand();
        winrt::Microsoft::UI::Xaml::Visibility DetailVisibility();
        winrt::Microsoft::UI::Xaml::Media::Brush LevelColor();

        winrt::event_token PropertyChanged(winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler const& handler);
        void PropertyChanged(winrt::event_token const& token) noexcept;

    private:
        hstring m_timestamp;
        hstring m_level;
        hstring m_module;
        hstring m_message;
        hstring m_traceId;
        hstring m_context;
        IrikaLoggerViewer::LogSettings m_settings{ nullptr };
        
        bool m_isExpanded{ false };
        winrt::Microsoft::UI::Xaml::Media::Brush m_levelColor{ nullptr };

        winrt::event<winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
        void RaisePropertyChanged(hstring const& propertyName);
    };
}

namespace winrt::IrikaLoggerViewer::factory_implementation
{
    struct LogItem : LogItemT<LogItem, implementation::LogItem>
    {
    };
}
