#pragma once

#include <juce_core/juce_core.h>
#include <utility>
#include <vector>

namespace mm
{
struct Preset
{
    juce::String name;
    juce::String category;   // "Mezcla" o "Master"
    juce::String tip;        // consejo que se muestra en la interfaz
    std::vector<std::pair<juce::String, float>> values;   // id de parametro -> valor real
};

const std::vector<Preset>& getPresets();
} // namespace mm
