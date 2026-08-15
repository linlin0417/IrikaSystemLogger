#pragma once
#include "LogSettings.g.h"
#include <winrt/Microsoft.UI.Xaml.Data.h>

namespace winrt::IrikaLoggerViewer::implementation
{
    struct LogSettings : LogSettingsT<LogSettings>
    {
        LogSettings();

        double ColTimeWidth();
        void ColTimeWidth(double value);

        double ColLevelWidth();
        void ColLevelWidth(double value);

        double ColModuleWidth();
        void ColModuleWidth(double value);

        double ColMessageWidth();
        void ColMessageWidth(double value);

        double ColTraceIdWidth();
        void ColTraceIdWidth(double value);

        winrt::event_token PropertyChanged(winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler const& handler);
        void PropertyChanged(winrt::event_token const& token) noexcept;

    private:
        double m_colTimeWidth{ 200.0 };
        double m_colLevelWidth{ 100.0 };
        double m_colModuleWidth{ 150.0 };
        double m_colMessageWidth{ 400.0 };
        double m_colTraceIdWidth{ 150.0 };

        winrt::event<winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
        void RaisePropertyChanged(hstring const& propertyName);
    };
}

namespace winrt::IrikaLoggerViewer::factory_implementation
{
    struct LogSettings : LogSettingsT<LogSettings, implementation::LogSettings>
    {
    };
}
