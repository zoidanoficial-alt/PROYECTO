#include "PluginProcessor.h"
#include "PluginEditor.h"

using APVTS = juce::AudioProcessorValueTreeState;

namespace
{
juce::NormalisableRange<float> freqRange (float lo, float hi)
{
    juce::NormalisableRange<float> r (lo, hi, 1.0f);
    r.setSkewForCentre (std::sqrt (lo * hi));
    return r;
}

juce::NormalisableRange<float> skewed (float lo, float hi, float centre, float step = 0.01f)
{
    juce::NormalisableRange<float> r (lo, hi, step);
    r.setSkewForCentre (centre);
    return r;
}

juce::String bandId (int b, const char* s) { return "b" + juce::String (b + 1) + "_" + s; }
} // namespace

//==============================================================================
APVTS::ParameterLayout MezclaMasterProcessor::createLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> p;
    auto fl = [&p] (const juce::String& id, const juce::String& name, juce::NormalisableRange<float> r, float def, const juce::String& unit = {})
    {
        p.push_back (std::make_unique<juce::AudioParameterFloat> (juce::ParameterID { id, 1 }, name, r, def,
                                                                   juce::AudioParameterFloatAttributes().withLabel (unit)));
    };
    auto bo = [&p] (const juce::String& id, const juce::String& name, bool def)
    {
        p.push_back (std::make_unique<juce::AudioParameterBool> (juce::ParameterID { id, 1 }, name, def));
    };
    const juce::NormalisableRange<float> gainR (-12.0f, 12.0f, 0.1f);

    fl ("in_gain", "Entrada", { -24.0f, 24.0f, 0.1f }, 0.0f, "dB");
    fl ("out_gain", "Salida", { -24.0f, 24.0f, 0.1f }, 0.0f, "dB");

    bo ("hpf_on", "Pasa altos ON", false);
    fl ("hpf_freq", "Pasa altos frec", freqRange (20.0f, 1000.0f), 30.0f, "Hz");
    p.push_back (std::make_unique<juce::AudioParameterChoice> (juce::ParameterID { "hpf_slope", 1 }, "Pasa altos pendiente",
                                                                juce::StringArray { "12 dB/oct", "24 dB/oct" }, 0));

    bo ("eq_on", "EQ ON", false);
    fl ("eq_low_f", "EQ graves frec", freqRange (30.0f, 500.0f), 100.0f, "Hz");
    fl ("eq_low_g", "EQ graves gan", gainR, 0.0f, "dB");
    fl ("eq_m1_f", "EQ medios1 frec", freqRange (80.0f, 2500.0f), 300.0f, "Hz");
    fl ("eq_m1_g", "EQ medios1 gan", gainR, 0.0f, "dB");
    fl ("eq_m1_q", "EQ medios1 Q", skewed (0.3f, 8.0f, 1.0f), 1.0f);
    fl ("eq_m2_f", "EQ medios2 frec", freqRange (500.0f, 12000.0f), 3000.0f, "Hz");
    fl ("eq_m2_g", "EQ medios2 gan", gainR, 0.0f, "dB");
    fl ("eq_m2_q", "EQ medios2 Q", skewed (0.3f, 8.0f, 1.0f), 1.0f);
    fl ("eq_high_f", "EQ agudos frec", freqRange (2000.0f, 18000.0f), 10000.0f, "Hz");
    fl ("eq_high_g", "EQ agudos gan", gainR, 0.0f, "dB");

    bo ("ds_on", "De-esser ON", false);
    fl ("ds_freq", "De-esser frec", freqRange (3000.0f, 12000.0f), 6500.0f, "Hz");
    fl ("ds_thr", "De-esser umbral", { -60.0f, 0.0f, 0.1f }, -30.0f, "dB");
    fl ("ds_range", "De-esser rango", { 0.0f, 20.0f, 0.1f }, 6.0f, "dB");

    bo ("cp_on", "Compresor ON", false);
    fl ("cp_thr", "Comp umbral", { -60.0f, 0.0f, 0.1f }, -18.0f, "dB");
    fl ("cp_ratio", "Comp ratio", skewed (1.0f, 30.0f, 4.0f), 3.0f, ":1");
    fl ("cp_att", "Comp ataque", skewed (0.1f, 100.0f, 10.0f), 10.0f, "ms");
    fl ("cp_rel", "Comp release", skewed (10.0f, 1000.0f, 120.0f, 1.0f), 120.0f, "ms");
    fl ("cp_makeup", "Comp makeup", { 0.0f, 24.0f, 0.1f }, 0.0f, "dB");
    fl ("cp_mix", "Comp mezcla", { 0.0f, 100.0f, 1.0f }, 100.0f, "%");
    bo ("cp_side", "Comp sidechain", false);

    bo ("mb_on", "Multibanda ON", false);
    fl ("xo1", "Cruce LOW/LOW-MID", freqRange (40.0f, 400.0f), 130.0f, "Hz");
    fl ("xo2", "Cruce LOW-MID/UP-MID", freqRange (400.0f, 4000.0f), 1500.0f, "Hz");
    fl ("xo3", "Cruce UP-MID/HIGH", freqRange (4000.0f, 16000.0f), 9000.0f, "Hz");
    bo ("low_mono", "Graves en mono", true);

    const char* names[numBands] = { "LOW", "LOW-MID", "UP-MID", "HIGH" };
    for (int b = 0; b < numBands; ++b)
    {
        const juce::String n = names[b];
        fl (bandId (b, "thr"), n + " umbral", { -60.0f, 0.0f, 0.1f }, -20.0f, "dB");
        fl (bandId (b, "ratio"), n + " ratio", skewed (1.0f, 30.0f, 4.0f), 2.0f, ":1");
        fl (bandId (b, "att"), n + " ataque", skewed (0.1f, 200.0f, 15.0f), 15.0f, "ms");
        fl (bandId (b, "rel"), n + " release", skewed (10.0f, 1000.0f, 120.0f, 1.0f), 120.0f, "ms");
        fl (bandId (b, "gain"), n + " ganancia", gainR, 0.0f, "dB");
        fl (bandId (b, "enh"), n + " realce", { 0.0f, 100.0f, 1.0f }, 0.0f, "%");
        fl (bandId (b, "width"), n + " ancho", { 0.0f, 200.0f, 1.0f }, 100.0f, "%");
        bo (bandId (b, "solo"), n + " solo", false);
        bo (bandId (b, "bypass"), n + " bypass", false);
    }

    bo ("lim_on", "Maximizador ON", false);
    fl ("lim_drive", "Maximizador drive", { 0.0f, 24.0f, 0.1f }, 0.0f, "dB");
    fl ("lim_ceil", "Maximizador techo", { -3.0f, 0.0f, 0.1f }, -0.2f, "dB");
    fl ("lim_rel", "Maximizador release", skewed (1.0f, 1000.0f, 80.0f, 1.0f), 80.0f, "ms");
    fl ("lufs_target", "Objetivo LUFS", { -20.0f, -6.0f, 0.5f }, -14.0f, "LUFS");

    return { p.begin(), p.end() };
}

//==============================================================================
MezclaMasterProcessor::MezclaMasterProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Entrada", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Salida", juce::AudioChannelSet::stereo(), true)
                          .withInput ("Sidechain", juce::AudioChannelSet::stereo(), false)),
      apvts (*this, nullptr, "MezclaMaster", createLayout())
{
    auto g = [this] (const juce::String& id) { return apvts.getRawParameterValue (id); };
    inGain = g ("in_gain"); outGain = g ("out_gain");
    hpfOn = g ("hpf_on"); hpfFreq = g ("hpf_freq"); hpfSlope = g ("hpf_slope");
    eqOn = g ("eq_on"); eqLowF = g ("eq_low_f"); eqLowG = g ("eq_low_g");
    eqM1F = g ("eq_m1_f"); eqM1G = g ("eq_m1_g"); eqM1Q = g ("eq_m1_q");
    eqM2F = g ("eq_m2_f"); eqM2G = g ("eq_m2_g"); eqM2Q = g ("eq_m2_q");
    eqHighF = g ("eq_high_f"); eqHighG = g ("eq_high_g");
    dsOn = g ("ds_on"); dsFreq = g ("ds_freq"); dsThr = g ("ds_thr"); dsRange = g ("ds_range");
    cpOn = g ("cp_on"); cpThr = g ("cp_thr"); cpRatio = g ("cp_ratio"); cpAtt = g ("cp_att");
    cpRel = g ("cp_rel"); cpMakeup = g ("cp_makeup"); cpMix = g ("cp_mix"); cpSide = g ("cp_side");
    mbOn = g ("mb_on"); xo[0] = g ("xo1"); xo[1] = g ("xo2"); xo[2] = g ("xo3"); lowMono = g ("low_mono");
    for (int b = 0; b < numBands; ++b)
        band[b] = { g (bandId (b, "thr")), g (bandId (b, "ratio")), g (bandId (b, "att")), g (bandId (b, "rel")),
                    g (bandId (b, "gain")), g (bandId (b, "enh")), g (bandId (b, "width")),
                    g (bandId (b, "solo")), g (bandId (b, "bypass")) };
    limOn = g ("lim_on"); limDrive = g ("lim_drive"); limCeil = g ("lim_ceil"); limRel = g ("lim_rel");
    lufsTarget = g ("lufs_target");

    for (auto& a : meters.bandGr) a.store (0.0f);
    for (auto& a : meters.bandPeak) a.store (-100.0f);
}

bool MezclaMasterProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    if (out != juce::AudioChannelSet::stereo() && out != juce::AudioChannelSet::mono()) return false;
    if (layouts.getMainInputChannelSet() != out) return false;
    if (layouts.inputBuses.size() > 1)
    {
        const auto sc = layouts.getChannelSet (true, 1);
        if (! sc.isDisabled() && sc != juce::AudioChannelSet::stereo() && sc != juce::AudioChannelSet::mono())
            return false;
    }
    return true;
}

void MezclaMasterProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    sr = sampleRate;
    juce::dsp::ProcessSpec mono { sampleRate, (juce::uint32) juce::jmax (1, samplesPerBlock), 1 };
    juce::dsp::ProcessSpec stereo { sampleRate, (juce::uint32) juce::jmax (1, samplesPerBlock), 2 };

    for (auto& stage : hpf) for (auto& f : stage) { f.coefficients = new Coefs (1, 0, 0, 1, 0, 0); f.prepare (mono); f.reset(); }
    for (auto& b : eq)      for (auto& f : b)     { f.coefficients = new Coefs (1, 0, 0, 1, 0, 0); f.prepare (mono); f.reset(); }
    lastFilterSettings.fill (-1.0f);

    for (auto* f : { &dsLp, &lp1, &lp2, &lp3, &ap2Low, &ap3Low, &ap3Mid }) { f->prepare (stereo); f->reset(); }
    for (auto* f : { &ap2Low, &ap3Low, &ap3Mid }) f->setType (juce::dsp::LinkwitzRileyFilterType::allpass);
    lastXo = { 0, 0, 0 };
    dsEnv = 0.0f;

    channelComp.prepare (sampleRate);
    deesserComp.prepare (sampleRate);
    for (auto& c : bandComp) c.prepare (sampleRate);
    for (auto& e : enhancer) e.prepare (sampleRate);
    bandPeakHold.fill (-100.0f);

    limiter.prepare (sampleRate);
    setLatencySamples (limiter.getLatency());   // latencia constante: FL la compensa

    for (auto* s : { &inGainSm, &outGainSm, &driveSm }) s->reset (sampleRate, 0.05);
    inGainSm.setCurrentAndTargetValue (mm::dbToGain (*inGain));
    outGainSm.setCurrentAndTargetValue (mm::dbToGain (*outGain));
    driveSm.setCurrentAndTargetValue (mm::dbToGain (*limOn > 0.5f ? limDrive->load() : 0.0f));

    loudness.prepare (sampleRate);
    updateFilters();
}

void MezclaMasterProcessor::updateFilters()
{
    using AC = juce::dsp::IIR::ArrayCoefficients<float>;
    const std::array<float, 16> now { *hpfFreq, *hpfSlope, *eqLowF, *eqLowG, *eqM1F, *eqM1G, *eqM1Q,
                                      *eqM2F, *eqM2G, *eqM2Q, *eqHighF, *eqHighG, *dsFreq, 0, 0, 0 };
    if (now != lastFilterSettings)
    {
        lastFilterSettings = now;
        const float nyq = (float) sr * 0.45f;
        const float hf = juce::jmin (hpfFreq->load(), nyq);
        if (*hpfSlope < 0.5f)
        {
            const auto c = AC::makeHighPass (sr, hf, 0.7071f);
            for (auto& f : hpf[0]) *f.coefficients = c;
        }
        else
        {
            const auto c0 = AC::makeHighPass (sr, hf, 0.5412f), c1 = AC::makeHighPass (sr, hf, 1.3066f);
            for (auto& f : hpf[0]) *f.coefficients = c0;
            for (auto& f : hpf[1]) *f.coefficients = c1;
        }
        const auto lo = AC::makeLowShelf (sr, juce::jmin (eqLowF->load(), nyq), 0.707f, mm::dbToGain (*eqLowG));
        const auto m1 = AC::makePeakFilter (sr, juce::jmin (eqM1F->load(), nyq), *eqM1Q, mm::dbToGain (*eqM1G));
        const auto m2 = AC::makePeakFilter (sr, juce::jmin (eqM2F->load(), nyq), *eqM2Q, mm::dbToGain (*eqM2G));
        const auto hi = AC::makeHighShelf (sr, juce::jmin (eqHighF->load(), nyq), 0.707f, mm::dbToGain (*eqHighG));
        for (auto& f : eq[0]) *f.coefficients = lo;
        for (auto& f : eq[1]) *f.coefficients = m1;
        for (auto& f : eq[2]) *f.coefficients = m2;
        for (auto& f : eq[3]) *f.coefficients = hi;
        dsLp.setCutoffFrequency (juce::jmin (dsFreq->load(), nyq));
    }

    // cruces ordenados y separados al menos 1 octava
    const float nyq = (float) sr * 0.45f;
    const float f1 = xo[0]->load(), f2 = juce::jmax (xo[1]->load(), f1 * 2.0f), f3 = juce::jmin (juce::jmax (xo[2]->load(), f2 * 2.0f), nyq);
    if (f1 != lastXo[0]) { lp1.setCutoffFrequency (f1); lastXo[0] = f1; }
    if (f2 != lastXo[1]) { lp2.setCutoffFrequency (f2); ap2Low.setCutoffFrequency (f2); lastXo[1] = f2; }
    if (f3 != lastXo[2]) { lp3.setCutoffFrequency (f3); ap3Low.setCutoffFrequency (f3); ap3Mid.setCutoffFrequency (f3); lastXo[2] = f3; }
}

//==============================================================================
void MezclaMasterProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    auto mainIn = getBusBuffer (buffer, true, 0);
    const int numCh = mainIn.getNumChannels();
    const int n = buffer.getNumSamples();
    if (numCh == 0 || n == 0) return;

    const float* scL = nullptr; const float* scR = nullptr;
    if (getBusCount (true) > 1 && getBus (true, 1)->isEnabled())
    {
        auto sc = getBusBuffer (buffer, true, 1);
        if (sc.getNumChannels() > 0)
        {
            scL = sc.getReadPointer (0);
            scR = sc.getNumChannels() > 1 ? sc.getReadPointer (1) : scL;
        }
    }

    if (resetMeterRequest.exchange (false)) loudness.reset();

    updateFilters();

    const bool hpfEnabled = *hpfOn > 0.5f, hpf24 = *hpfSlope > 0.5f, eqEnabled = *eqOn > 0.5f;
    const bool dsEnabled = *dsOn > 0.5f, cpEnabled = *cpOn > 0.5f, mbEnabled = *mbOn > 0.5f, limEnabled = *limOn > 0.5f;
    // con "sidechain externo" activado pero sin nada conectado, el compresor no actua
    const bool wantSide = *cpSide > 0.5f;
    const bool useSide = wantSide && scL != nullptr;

    deesserComp.setParams (*dsThr, 4.0f, 1.0f, 60.0f, 3.0f);
    const float dsFloor = mm::dbToGain (-dsRange->load());
    channelComp.setParams (*cpThr, *cpRatio, *cpAtt, *cpRel);
    const float cpMake = mm::dbToGain (*cpMakeup), cpWet = *cpMix * 0.01f;

    bool anySolo = false;
    std::array<float, numBands> bGain {}, bEnh {}, bWidth {};
    std::array<bool, numBands> bOn {}, bSolo {};
    for (int b = 0; b < numBands; ++b)
    {
        bandComp[(size_t) b].setParams (*band[b].thr, *band[b].ratio, *band[b].att, *band[b].rel);
        bGain[(size_t) b] = mm::dbToGain (*band[b].gain);
        bEnh[(size_t) b] = *band[b].enh * 0.01f;
        bWidth[(size_t) b] = (b == 0 && *lowMono > 0.5f) ? 0.0f : *band[b].width * 0.01f;
        bOn[(size_t) b] = *band[b].bypass < 0.5f;
        bSolo[(size_t) b] = *band[b].solo > 0.5f;
        anySolo = anySolo || bSolo[(size_t) b];
    }

    limiter.setParams (limEnabled ? limCeil->load() : 24.0f, *limRel);
    inGainSm.setTargetValue (mm::dbToGain (*inGain));
    outGainSm.setTargetValue (mm::dbToGain (*outGain));
    driveSm.setTargetValue (mm::dbToGain (limEnabled ? limDrive->load() : 0.0f));

    float* L = mainIn.getWritePointer (0);
    float* R = numCh > 1 ? mainIn.getWritePointer (1) : nullptr;

    float inPkL = 0, inPkR = 0, outPkL = 0, outPkR = 0, cpMinG = 1, dsMinG = 1;
    std::array<float, numBands> bMinG { 1, 1, 1, 1 }, bPk {};
    double sLR = 0, sLL = 0, sRR = 0;

    for (int i = 0; i < n; ++i)
    {
        const float ig = inGainSm.getNextValue();
        float l = L[i] * ig;
        float r = (R ? R[i] : L[i]) * ig;
        inPkL = juce::jmax (inPkL, std::abs (l)); inPkR = juce::jmax (inPkR, std::abs (r));

        // 1) pasa altos
        if (hpfEnabled)
        {
            l = hpf[0][0].processSample (l); r = hpf[0][1].processSample (r);
            if (hpf24) { l = hpf[1][0].processSample (l); r = hpf[1][1].processSample (r); }
        }

        // 2) EQ
        if (eqEnabled)
            for (auto& b : eq) { l = b[0].processSample (l); r = b[1].processSample (r); }

        // 3) De-esser de banda dividida: solo atenua lo que esta arriba de la frecuencia
        if (dsEnabled)
        {
            float lLo, lHi, rLo, rHi;
            dsLp.processSample (0, l, lLo, lHi);
            dsLp.processSample (1, r, rLo, rHi);
            const float g = juce::jmax (dsFloor, deesserComp.process (juce::jmax (std::abs (lHi), std::abs (rHi))));
            dsMinG = juce::jmin (dsMinG, g);
            l = lLo + lHi * g; r = rLo + rHi * g;
        }

        // 4) Compresor de pista (paralelo + sidechain)
        if (cpEnabled)
        {
            const float det = useSide ? juce::jmax (std::abs (scL[i]), std::abs (scR[i]))
                            : wantSide ? 0.0f
                                       : juce::jmax (std::abs (l), std::abs (r));
            const float g = channelComp.process (det);
            cpMinG = juce::jmin (cpMinG, g);
            const float wg = g * cpMake * cpWet + (1.0f - cpWet);
            l *= wg; r *= wg;
        }

        // 5) Multibanda de 4 bandas (Rogers)
        if (mbEnabled)
        {
            float bl[numBands], br[numBands], restL, restR, rest2L, rest2R;
            lp1.processSample (0, l, bl[0], restL);
            lp1.processSample (1, r, br[0], restR);
            lp2.processSample (0, restL, bl[1], rest2L);
            lp2.processSample (1, restR, br[1], rest2R);
            lp3.processSample (0, rest2L, bl[2], bl[3]);
            lp3.processSample (1, rest2R, br[2], br[3]);
            bl[0] = ap3Low.processSample (0, ap2Low.processSample (0, bl[0]));
            br[0] = ap3Low.processSample (1, ap2Low.processSample (1, br[0]));
            bl[1] = ap3Mid.processSample (0, bl[1]);
            br[1] = ap3Mid.processSample (1, br[1]);

            l = r = 0.0f;
            for (int b = 0; b < numBands; ++b)
            {
                const auto bi = (size_t) b;
                float x = bl[b], y = br[b];
                const float pk = juce::jmax (std::abs (x), std::abs (y));
                bPk[bi] = juce::jmax (bPk[bi], pk);
                if (bOn[bi])
                {
                    const float g = bandComp[bi].process (pk) * bGain[bi];
                    bMinG[bi] = juce::jmin (bMinG[bi], g / bGain[bi]);
                    x *= g; y *= g;
                    x = enhancer[bi].process (0, x, bEnh[bi]);
                    y = enhancer[bi].process (1, y, bEnh[bi]);
                    const float mid = 0.5f * (x + y), side = 0.5f * (x - y) * bWidth[bi];
                    x = mid + side; y = mid - side;
                }
                if (! anySolo || bSolo[bi]) { l += x; r += y; }
            }
        }

        // 6) Maximizador (siempre pasa por el retardo para latencia constante)
        const float dr = driveSm.getNextValue();
        l *= dr; r *= dr;
        limiter.process (l, r);

        const float og = outGainSm.getNextValue();
        l *= og; r *= og;

        if (! std::isfinite (l)) l = 0.0f;
        if (! std::isfinite (r)) r = 0.0f;

        outPkL = juce::jmax (outPkL, std::abs (l)); outPkR = juce::jmax (outPkR, std::abs (r));
        sLR += (double) l * r; sLL += (double) l * l; sRR += (double) r * r;
        loudness.process (l, r);

        if (R) { L[i] = l; R[i] = r; }
        else     L[i] = 0.5f * (l + r);
    }

    // limpia canales de salida extra
    for (int ch = getTotalNumInputChannels(); ch < getTotalNumOutputChannels(); ++ch)
        if (ch >= numCh) buffer.clear (ch, 0, n);

    // medidores
    auto decay = [] (std::atomic<float>& a, float v) { a.store (juce::jmax (v, a.load() - 1.5f)); };
    decay (meters.inL, mm::gainToDb (inPkL));  decay (meters.inR, mm::gainToDb (inPkR));
    decay (meters.outL, mm::gainToDb (outPkL)); decay (meters.outR, mm::gainToDb (outPkR));
    meters.limGr.store (mm::gainToDb (limiter.takeMinGain()));
    meters.compGr.store (cpEnabled ? mm::gainToDb (cpMinG) : 0.0f);
    meters.deessGr.store (dsEnabled ? mm::gainToDb (dsMinG) : 0.0f);
    const float blockSec = (float) n / (float) sr;
    for (int b = 0; b < numBands; ++b)
    {
        const auto bi = (size_t) b;
        meters.bandGr[bi].store (mbEnabled && bOn[bi] ? mm::gainToDb (bMinG[bi]) : 0.0f);
        // pico retenido que cae 3 dB/s: lo usan los botones Leve/Adelgazar/Cortar picos
        bandPeakHold[bi] = juce::jmax (mm::gainToDb (bPk[bi]), bandPeakHold[bi] - 3.0f * blockSec);
        meters.bandPeak[bi].store (mbEnabled ? bandPeakHold[bi] : -100.0f);
    }
    if (sLL > 1e-9 && sRR > 1e-9)
    {
        const float c = (float) (sLR / std::sqrt (sLL * sRR));
        meters.correlation.store (0.9f * meters.correlation.load() + 0.1f * c);
    }
}

//==============================================================================
void MezclaMasterProcessor::setParam (const juce::String& id, float value)
{
    if (auto* p = apvts.getParameter (id))
    {
        p->beginChangeGesture();
        p->setValueNotifyingHost (p->convertTo0to1 (value));
        p->endChangeGesture();
    }
}

void MezclaMasterProcessor::applyPreset (int index)
{
    const auto& presets = mm::getPresets();
    if (! juce::isPositiveAndBelow (index, (int) presets.size())) return;

    for (auto* p : getParameters())
        if (auto* rp = dynamic_cast<juce::RangedAudioParameter*> (p))
        {
            rp->beginChangeGesture();
            rp->setValueNotifyingHost (rp->getDefaultValue());
            rp->endChangeGesture();
        }
    for (const auto& [id, value] : presets[(size_t) index].values)
        setParam (id, value);

    currentProgram = index;
    resetLoudness();
}

int MezclaMasterProcessor::getNumPrograms() { return (int) mm::getPresets().size(); }

void MezclaMasterProcessor::setCurrentProgram (int index)
{
    // Algunos hosts llaman setCurrentProgram al cargar el proyecto: si es el
    // mismo programa no tocamos nada para no borrar los ajustes guardados.
    if (index != currentProgram) applyPreset (index);
}

const juce::String MezclaMasterProcessor::getProgramName (int index)
{
    const auto& presets = mm::getPresets();
    return juce::isPositiveAndBelow (index, (int) presets.size()) ? presets[(size_t) index].name : juce::String();
}

void MezclaMasterProcessor::applyBandMacro (int b, BandMacro macro)
{
    if (! juce::isPositiveAndBelow (b, numBands)) return;
    float peak = meters.bandPeak[(size_t) b].load();
    if (peak < -60.0f) peak = -12.0f;   // sin audio: valor tipico

    // Rogers: Leve = umbral 50 % y 4:1, Adelgazar = 60 % y 8:1 (quita ~25 %),
    // Cortar picos = 80 % y 30:1. Aqui el umbral se fija relativo al pico de la banda.
    float thr = peak, ratio = 4, att = 30, rel = 150;
    switch (macro)
    {
        case BandMacro::leve:        thr = peak - 5.0f; ratio = 4.0f;  att = 30.0f; rel = 150.0f; break;
        case BandMacro::adelgazar:   thr = peak - 8.0f; ratio = 8.0f;  att = 10.0f; rel = 120.0f; break;
        case BandMacro::cortarPicos: thr = peak - 2.5f; ratio = 30.0f; att = 1.0f;  rel = 60.0f;  break;
    }
    setParam (bandId (b, "thr"), juce::jlimit (-60.0f, 0.0f, thr));
    setParam (bandId (b, "ratio"), ratio);
    setParam (bandId (b, "att"), att);
    setParam (bandId (b, "rel"), rel);
    setParam (bandId (b, "bypass"), 0.0f);
    setParam ("mb_on", 1.0f);
}

float MezclaMasterProcessor::matchLoudnessTarget()
{
    float measured = loudness.integrated.load();
    if (measured < -70.0f) measured = loudness.shortTerm.load();
    if (measured < -60.0f) return 0.0f;

    const float delta = lufsTarget->load() - measured;
    const float cur = *limOn > 0.5f ? limDrive->load() : 0.0f;
    const float next = juce::jlimit (0.0f, 24.0f, cur + delta);
    setParam ("lim_on", 1.0f);
    setParam ("lim_drive", next);
    resetLoudness();
    return next - cur;
}

//==============================================================================
void MezclaMasterProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("program", currentProgram, nullptr);
    if (auto xml = state.createXml()) copyXmlToBinary (*xml, destData);
}

void MezclaMasterProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
        {
            auto tree = juce::ValueTree::fromXml (*xml);
            currentProgram = tree.getProperty ("program", 0);
            apvts.replaceState (tree);
        }
}

juce::AudioProcessorEditor* MezclaMasterProcessor::createEditor() { return new MezclaMasterEditor (*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MezclaMasterProcessor(); }
