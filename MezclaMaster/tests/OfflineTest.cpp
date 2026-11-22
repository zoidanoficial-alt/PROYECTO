// Prueba offline del DSP de MezclaMaster: corre cada preset sobre una
// "mezcla" sintetica y verifica que no haya NaN, que el maximizador
// respete el techo, que el modo neutro sea transparente y que el medidor
// LUFS este calibrado.

#include <juce_audio_processors/juce_audio_processors.h>
#include "PluginProcessor.h"
#include <cstdio>

namespace
{
int failures = 0;
void check (bool ok, const juce::String& what)
{
    std::printf ("[%s] %s\n", ok ? " OK " : "FALLA", what.toRawUTF8());
    if (! ok) ++failures;
}

// bombo de 55 Hz cada 0.5 s + bajo + "voz" en 1-4 kHz + platillos (ruido agudo)
void fillMix (juce::AudioBuffer<float>& b, double sr, long long& pos, juce::Random& rnd, float level)
{
    for (int i = 0; i < b.getNumSamples(); ++i, ++pos)
    {
        const double t = (double) pos / sr;
        const double beat = std::fmod (t, 0.5);
        const double kick = std::sin (2 * juce::MathConstants<double>::pi * 55 * beat) * std::exp (-beat * 12);
        const double bass = 0.3 * std::sin (2 * juce::MathConstants<double>::pi * 82.4 * t);
        const double voice = 0.25 * std::sin (2 * juce::MathConstants<double>::pi * (1200 + 600 * std::sin (t * 3)) * t);
        const float hat = (rnd.nextFloat() * 2 - 1) * 0.08f * (float) std::exp (-std::fmod (t, 0.25) * 30);
        const float l = level * (float) (kick + bass + voice) + hat;
        const float r = level * (float) (kick + bass + 0.8 * voice) - hat;
        b.setSample (0, i, l);
        b.setSample (1, i, r);
    }
}

float run (MezclaMasterProcessor& p, double sr, double seconds, float level, float* peakOut = nullptr)
{
    const int bs = 512;
    juce::AudioBuffer<float> buf (2, bs);
    juce::MidiBuffer midi;
    juce::Random rnd (1234);
    long long pos = 0;
    float peak = 0, nanCount = 0;
    for (int done = 0; done < (int) (seconds * sr); done += bs)
    {
        fillMix (buf, sr, pos, rnd, level);
        p.processBlock (buf, midi);
        for (int ch = 0; ch < 2; ++ch)
            for (int i = 0; i < bs; ++i)
            {
                const float v = buf.getSample (ch, i);
                if (! std::isfinite (v)) ++nanCount;
                peak = juce::jmax (peak, std::abs (v));
            }
    }
    if (peakOut) *peakOut = peak;
    return nanCount;
}
} // namespace

int main()
{
    juce::ScopedJuceInitialiser_GUI init;
    const double sr = 48000.0;

    // 1) calibracion LUFS: seno de 1 kHz a -20 dBFS en ambos canales = -20 LUFS
    {
        MezclaMasterProcessor p;
        p.prepareToPlay (sr, 512);
        juce::AudioBuffer<float> buf (2, 512);
        juce::MidiBuffer midi;
        long long pos = 0;
        for (int blk = 0; blk < (int) (5 * sr / 512); ++blk)
        {
            for (int i = 0; i < 512; ++i, ++pos)
            {
                const float v = 0.1f * (float) std::sin (2 * juce::MathConstants<double>::pi * 1000.0 * pos / sr);
                buf.setSample (0, i, v); buf.setSample (1, i, v);
            }
            p.processBlock (buf, midi);
        }
        const float lufs = p.loudness.integrated.load();
        check (std::abs (lufs + 20.0f) < 0.3f, "LUFS de seno 1 kHz -20 dBFS = " + juce::String (lufs, 2) + " (esperado -20.0)");
    }

    // 2) modo neutro transparente (salida = entrada retrasada por la latencia)
    {
        MezclaMasterProcessor p;
        p.prepareToPlay (sr, 256);
        const int lat = p.getLatencySamples();
        juce::AudioBuffer<float> buf (2, 256);
        juce::MidiBuffer midi;
        std::vector<float> in, out;
        juce::Random rnd (7);
        for (int blk = 0; blk < 40; ++blk)
        {
            for (int i = 0; i < 256; ++i)
            {
                const float v = rnd.nextFloat() * 1.6f - 0.8f;
                buf.setSample (0, i, v); buf.setSample (1, i, -v);
                in.push_back (v);
            }
            p.processBlock (buf, midi);
            for (int i = 0; i < 256; ++i) out.push_back (buf.getSample (0, i));
        }
        float maxErr = 0;
        for (size_t i = (size_t) lat; i < out.size(); ++i) maxErr = juce::jmax (maxErr, std::abs (out[i] - in[i - (size_t) lat]));
        check (maxErr < 1e-5f, "Neutro transparente (latencia " + juce::String (lat) + " muestras, error " + juce::String (maxErr, 8) + ")");
    }

    // 2b) multibanda sin compresion: la suma de las 4 bandas debe ser plana
    {
        MezclaMasterProcessor a, b;
        a.prepareToPlay (sr, 512); b.prepareToPlay (sr, 512);
        if (auto* q = b.apvts.getParameter ("mb_on")) q->setValueNotifyingHost (1.0f);
        if (auto* q = b.apvts.getParameter ("low_mono")) q->setValueNotifyingHost (0.0f);
        for (int i = 1; i <= 4; ++i)
            if (auto* q = b.apvts.getParameter ("b" + juce::String (i) + "_ratio")) q->setValueNotifyingHost (0.0f);
        run (a, sr, 6.0, 0.4f); run (b, sr, 6.0, 0.4f);
        const float d = b.loudness.integrated.load() - a.loudness.integrated.load();
        check (std::abs (d) < 0.2f, "Divisor de 4 bandas plano (diferencia " + juce::String (d, 3) + " LU)");
    }

    // 3) cada preset: sin NaN y, si el maximizador esta activo, sin pasar el techo
    const auto& presets = mm::getPresets();
    for (int i = 0; i < (int) presets.size(); ++i)
    {
        MezclaMasterProcessor p;
        p.prepareToPlay (sr, 512);
        p.applyPreset (i);
        float peak = 0;
        const float nans = run (p, sr, 6.0, 0.7f, &peak);
        const bool limOn = p.apvts.getRawParameterValue ("lim_on")->load() > 0.5f;
        const float ceil = p.apvts.getRawParameterValue ("lim_ceil")->load();
        const float outG = p.apvts.getRawParameterValue ("out_gain")->load();
        juce::String msg = presets[(size_t) i].name + ": pico " + juce::String (mm::gainToDb (peak), 2) + " dBFS, "
                         + juce::String (p.loudness.integrated.load(), 1) + " LUFS";
        bool ok = nans == 0;
        if (limOn) ok = ok && mm::gainToDb (peak) <= ceil + outG + 0.01f;
        check (ok, msg);
    }

    // 4) macros por banda y "Igualar LUFS" convergen al objetivo del genero
    {
        MezclaMasterProcessor p;
        p.prepareToPlay (sr, 512);
        int hiphop = 0;
        for (int i = 0; i < (int) presets.size(); ++i) if (presets[(size_t) i].name.contains ("Hip-Hop")) hiphop = i;
        p.applyPreset (hiphop);
        run (p, sr, 3.0, 0.3f);
        for (int b = 0; b < 4; ++b) p.applyBandMacro (b, b == 2 ? MezclaMasterProcessor::BandMacro::cortarPicos
                                                              : MezclaMasterProcessor::BandMacro::leve);
        for (int it = 0; it < 4; ++it) { run (p, sr, 6.0, 0.3f); p.matchLoudnessTarget(); }
        float peak = 0;
        run (p, sr, 8.0, 0.3f, &peak);
        const float target = p.apvts.getRawParameterValue ("lufs_target")->load();
        const float got = p.loudness.integrated.load();
        check (std::abs (got - target) < 1.0f, "Igualar LUFS (hip-hop): " + juce::String (got, 2) + " LUFS vs objetivo "
                                                 + juce::String (target, 1) + ", pico " + juce::String (mm::gainToDb (peak), 2) + " dBFS");
    }

    std::printf ("\n%s (%d fallas)\n", failures == 0 ? "TODO BIEN" : "HAY FALLAS", failures);
    return failures == 0 ? 0 : 1;
}
