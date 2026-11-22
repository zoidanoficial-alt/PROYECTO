#pragma once

#include <juce_gui_basics/juce_gui_basics.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include "PluginProcessor.h"

class MezclaLookAndFeel : public juce::LookAndFeel_V4
{
public:
    MezclaLookAndFeel();
    void drawRotarySlider (juce::Graphics&, int x, int y, int w, int h, float pos,
                           float start, float end, juce::Slider&) override;
};

// Perilla con etiqueta y vinculo al parametro
class Knob : public juce::Component
{
public:
    Knob (juce::AudioProcessorValueTreeState& s, const juce::String& id, const juce::String& label);
    void resized() override;
    juce::Slider slider;
private:
    juce::Label label;
    juce::AudioProcessorValueTreeState::SliderAttachment attachment;
};

class Toggle : public juce::ToggleButton
{
public:
    Toggle (juce::AudioProcessorValueTreeState& s, const juce::String& id, const juce::String& text);
private:
    juce::AudioProcessorValueTreeState::ButtonAttachment attachment;
};

// Barra vertical para medidores (nivel o reduccion de ganancia)
class Meter : public juce::Component
{
public:
    Meter (std::function<float()> source, bool isGainReduction, juce::String caption);
    void paint (juce::Graphics&) override;
    void refresh();
private:
    std::function<float()> source;
    bool gr;
    juce::String caption;
    float value = -100.0f;
};

class MezclaMasterEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit MezclaMasterEditor (MezclaMasterProcessor&);
    ~MezclaMasterEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    Knob* knob (const juce::String& id, const juce::String& label);
    Toggle* toggle (const juce::String& id, const juce::String& text);
    void updateTip();

    MezclaMasterProcessor& proc;
    MezclaLookAndFeel lnf;

    juce::OwnedArray<Knob> knobs;
    juce::OwnedArray<Toggle> toggles;
    juce::OwnedArray<Meter> meterComps;
    juce::OwnedArray<juce::TextButton> macroButtons;

    juce::ComboBox presetBox, slopeBox;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> slopeAttach;
    juce::TextButton matchButton { "Igualar LUFS" }, resetButton { "Reiniciar medidor" };
    juce::Label lufsLabel, tipBox, statusLabel;

    struct Section { juce::String title; juce::Rectangle<int> area; };
    std::vector<Section> sections;

    // atajos a componentes para el layout
    std::map<juce::String, Knob*> k;
    std::map<juce::String, Toggle*> t;
    int lastProgram = -1;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MezclaMasterEditor)
};
