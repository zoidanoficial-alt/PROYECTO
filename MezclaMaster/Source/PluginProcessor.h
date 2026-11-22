#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>
#include "DSP.h"
#include "Presets.h"

// Cadena de MezclaMaster (en este orden, cada modulo se puede apagar):
//  Entrada -> Pasa altos -> EQ de 4 bandas -> De-esser -> Compresor de pista
//  (con mezcla paralela y sidechain) -> Multibanda de 4 bandas (compresion,
//  realce, ancho M/S, graves en mono) -> Maximizador -> Salida
class MezclaMasterProcessor : public juce::AudioProcessor
{
public:
    static constexpr int numBands = 4;

    MezclaMasterProcessor();
    ~MezclaMasterProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MezclaMaster"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override;
    int getCurrentProgram() override { return currentProgram; }
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // --- usado por la interfaz ---
    void applyPreset (int index);
    enum class BandMacro { leve, adelgazar, cortarPicos };
    void applyBandMacro (int band, BandMacro macro);
    float matchLoudnessTarget();   // ajusta el "drive" del maximizador; devuelve dB aplicados
    void resetLoudness() { resetMeterRequest.store (true); }

    juce::AudioProcessorValueTreeState apvts;

    struct Meters
    {
        std::atomic<float> inL { -100 }, inR { -100 }, outL { -100 }, outR { -100 };
        std::atomic<float> limGr { 0 }, compGr { 0 }, deessGr { 0 };
        std::array<std::atomic<float>, numBands> bandGr {}, bandPeak {};
        std::atomic<float> correlation { 1 };
    } meters;

    mm::LoudnessMeter loudness;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void setParam (const juce::String& id, float value);
    void updateFilters();

    struct BandParams { std::atomic<float>* thr, *ratio, *att, *rel, *gain, *enh, *width, *solo, *bypass; };

    // punteros a parametros (lectura sin bloqueo)
    std::atomic<float>* inGain {}, *outGain {};
    std::atomic<float>* hpfOn {}, *hpfFreq {}, *hpfSlope {};
    std::atomic<float>* eqOn {}, *eqLowF {}, *eqLowG {}, *eqM1F {}, *eqM1G {}, *eqM1Q {},
                       *eqM2F {}, *eqM2G {}, *eqM2Q {}, *eqHighF {}, *eqHighG {};
    std::atomic<float>* dsOn {}, *dsFreq {}, *dsThr {}, *dsRange {};
    std::atomic<float>* cpOn {}, *cpThr {}, *cpRatio {}, *cpAtt {}, *cpRel {}, *cpMakeup {}, *cpMix {}, *cpSide {};
    std::atomic<float>* mbOn {}, *xo[3] {}, *lowMono {};
    BandParams band[numBands] {};
    std::atomic<float>* limOn {}, *limDrive {}, *limCeil {}, *limRel {}, *lufsTarget {};

    double sr = 44100.0;
    int currentProgram = 0;
    std::atomic<bool> resetMeterRequest { false };

    using IIR = juce::dsp::IIR::Filter<float>;
    using Coefs = juce::dsp::IIR::Coefficients<float>;
    std::array<std::array<IIR, 2>, 2> hpf;          // [etapa][canal]
    std::array<std::array<IIR, 2>, 4> eq;           // [banda][canal]
    std::array<float, 16> lastFilterSettings {};

    juce::dsp::LinkwitzRileyFilter<float> dsLp;
    float dsEnv = 0.0f;

    mm::Compressor channelComp, deesserComp;
    std::array<mm::Compressor, numBands> bandComp;
    std::array<mm::Enhancer, numBands> enhancer;

    // Divisor de 4 bandas Linkwitz-Riley de 4o orden con compensacion de fase
    juce::dsp::LinkwitzRileyFilter<float> lp1, lp2, lp3, ap2Low, ap3Low, ap3Mid;
    std::array<float, 3> lastXo { 0, 0, 0 };

    mm::Limiter limiter;
    juce::SmoothedValue<float> inGainSm, outGainSm, driveSm;
    std::array<float, numBands> bandPeakHold {};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MezclaMasterProcessor)
};
