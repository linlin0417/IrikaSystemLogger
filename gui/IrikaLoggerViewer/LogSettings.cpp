#include "pch.h"
#include "LogSettings.h"
#include "LogSettings.g.cpp"

namespace winrt::IrikaLoggerViewer::implementation
{
    LogSettings::LogSettings()
    {
    }

    double LogSettings::ColTimeWidth() { return m_colTimeWidth; }
    void LogSettings::ColTimeWidth(double value) {
        if (m_colTimeWidth != value) {
            m_colTimeWidth = value;
            RaisePropertyChanged(L"ColTimeWidth");
        }
    }

    double LogSettings::ColLevelWidth() { return m_colLevelWidth; }
    void LogSettings::ColLevelWidth(double value) {
        if (m_colLevelWidth != value) {
            m_colLevelWidth = value;
            RaisePropertyChanged(L"ColLevelWidth");
        }
    }

    double LogSettings::ColModuleWidth() { return m_colModuleWidth; }
    void LogSettings::ColModuleWidth(double value) {
        if (m_colModuleWidth != value) {
            m_colModuleWidth = value;
            RaisePropertyChanged(L"ColModuleWidth");
        }
    }

    double LogSettings::ColMessageWidth() { return m_colMessageWidth; }
    void LogSettings::ColMessageWidth(double value) {
        if (m_colMessageWidth != value) {
            m_colMessageWidth = value;
            RaisePropertyChanged(L"ColMessageWidth");
        }
    }

    double LogSettings::ColTraceIdWidth() { return m_colTraceIdWidth; }
    void LogSettings::ColTraceIdWidth(double value) {
        if (m_colTraceIdWidth != value) {
            m_colTraceIdWidth = value;
            RaisePropertyChanged(L"ColTraceIdWidth");
        }
    }

    winrt::event_token LogSettings::PropertyChanged(winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler const& handler)
    {
        return m_propertyChanged.add(handler);
    }

    void LogSettings::PropertyChanged(winrt::event_token const& token) noexcept
    {
        m_propertyChanged.remove(token);
    }

    void LogSettings::RaisePropertyChanged(hstring const& propertyName)
    {
        m_propertyChanged(*this, winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventArgs(propertyName));
    }
}
