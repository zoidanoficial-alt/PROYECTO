#include "PluginEditor.h"

namespace
{
const juce::Colour bg      { 0xff14161b };
const juce::Colour panel   { 0xff1e222a };
const juce::Colour edge    { 0xff2d333e };
const juce::Colour accent  { 0xff3cc3b8 };
const juce::Colour warm    { 0xfff0a443 };
const juce::Colour textCol { 0xffd9dde4 };
const juce::Colour dimText { 0xff8a93a3 };

constexpr int knobW = 66, knobH = 84;
}

//==============================================================================
MezclaLookAndFeel::MezclaLookAndFeel()
{
    setColour (juce::Slider::textBoxTextColourId, textCol);
    setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    setColour (juce::Label::textColourId, textCol);
    setColour (juce::ToggleButton::textColourId, textCol);
    setColour (juce::ToggleButton::tickColourId, accent);
    setColour (juce::ComboBox::backgroundColourId, panel.brighter (0.05f));
    setColour (juce::ComboBox::outlineColourId, edge);
    setColour (juce::ComboBox::textColourId, textCol);
    setColour (juce::PopupMenu::backgroundColourId, panel);
    setColour (juce::PopupMenu::highlightedBackgroundColourId, accent.withAlpha (0.35f));
    setColour (juce::TextButton::buttonColourId, edge);
    setColour (juce::TextButton::textColourOffId, textCol);
}

void MezclaLookAndFeel::drawRotarySlider (juce::Graphics& g, int x, int y, int w, int h, float pos,
                                          float start, float end, juce::Slider& s)
{
    const auto b = juce::Rectangle<int> (x, y, w, h).toFloat().reduced (4.0f);
    const float radius = juce::jmin (b.getWidth(), b.getHeight()) * 0.5f;
    const auto c = b.getCentre();
    const float angle = start + pos * (end - start);
    const float lw = 3.5f;

    juce::Path track, value;
    track.addCentredArc (c.x, c.y, radius - lw, radius - lw, 0, start, end, true);
    g.setColour (edge);
    g.strokePath (track, juce::PathStrokeType (lw, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    // los parametros bipolares (ganancias) se dibujan desde el centro
    const bool bipolar = s.getMinimum() < 0.0 && s.getMaximum() > 0.0 && std::abs (s.getMinimum() + s.getMaximum()) < 1e-3;
    const float from = bipolar ? (start + end) * 0.5f : start;
    value.addCentredArc (c.x, c.y, radius - lw, radius - lw, 0, juce::jmin (from, angle), juce::jmax (from, angle), true);
    g.setColour (s.isEnabled() ? accent : dimText);
    g.strokePath (value, juce::PathStrokeType (lw, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    g.setColour (panel.brighter (0.15f));
    g.fillEllipse (juce::Rectangle<float> (radius * 1.2f, radius * 1.2f).withCentre (c));
    juce::Path needle;
    needle.addRoundedRectangle (-1.5f, -radius * 0.62f, 3.0f, radius * 0.36f, 1.5f);
    g.setColour (textCol);
    g.fillPath (needle, juce::AffineTransform::rotation (angle).translated (c.x, c.y));
}

//==============================================================================
Knob::Knob (juce::AudioProcessorValueTreeState& s, const juce::String& id, const juce::String& text)
    : attachment (s, id, slider)
{
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, knobW, 14);
    slider.setDoubleClickReturnValue (true, (double) s.getParameterRange (id).convertFrom0to1 (s.getParameter (id)->getDefaultValue()));
    slider.setPopupDisplayEnabled (false, false, nullptr);
    slider.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    if (auto* p = s.getParameter (id)) slider.setTooltip (p->getName (64));
    label.setText (text, juce::dontSendNotification);
    label.setJustificationType (juce::Justification::centred);
    label.setFont (juce::FontOptions (11.5f));
    label.setColour (juce::Label::textColourId, dimText);
    addAndMakeVisible (slider);
    addAndMakeVisible (label);
}

void Knob::resized()
{
    auto r = getLocalBounds();
    label.setBounds (r.removeFromTop (14));
    slider.setBounds (r);
}

Toggle::Toggle (juce::AudioProcessorValueTreeState& s, const juce::String& id, const juce::String& caption)
    : juce::ToggleButton (caption), attachment (s, id, *this) {}

//==============================================================================
Meter::Meter (std::function<float()> src, bool isGr, juce::String cap)
    : source (std::move (src)), gr (isGr), caption (std::move (cap)) {}

void Meter::refresh()
{
    const float v = source();
    if (std::abs (v - value) > 0.05f) { value = v; repaint(); }
}

void Meter::paint (juce::Graphics& g)
{
    auto r = getLocalBounds().toFloat();
    auto capArea = r.removeFromBottom (14);
    g.setColour (bg);
    g.fillRoundedRectangle (r, 3.0f);
    if (gr)
    {
        const float frac = juce::jlimit (0.0f, 1.0f, -value / 24.0f);
        g.setColour (warm);
        g.fillRoundedRectangle (r.withHeight (r.getHeight() * frac), 3.0f);
    }
    else
    {
        const float frac = juce::jlimit (0.0f, 1.0f, (value + 60.0f) / 63.0f);
        auto bar = r.withTrimmedTop (r.getHeight() * (1.0f - frac));
        g.setColour (value > -0.1f ? juce::Colours::red : value > -6.0f ? warm : accent);
        g.fillRoundedRectangle (bar, 3.0f);
    }
    g.setColour (dimText);
    g.setFont (juce::FontOptions (10.0f));
    g.drawText (caption, capArea, juce::Justification::centred);
}

//==============================================================================
MezclaMasterEditor::MezclaMasterEditor (MezclaMasterProcessor& p)
    : AudioProcessorEditor (&p), proc (p)
{
    setLookAndFeel (&lnf);

    // --- presets ---
    const auto& presets = mm::getPresets();
    juce::String lastCat;
    for (int i = 0; i < (int) presets.size(); ++i)
    {
        const auto& pr = presets[(size_t) i];
        if (pr.category != lastCat)
        {
            presetBox.addSectionHeading (pr.category == "Master" ? "MASTERIZACION (bus maestro, al final)"
                                       : pr.category == "Mezcla" ? "MEZCLA (en cada pista o bus)" : "GENERAL");
            lastCat = pr.category;
        }
        presetBox.addItem (pr.name, i + 1);
    }
    presetBox.setSelectedId (proc.getCurrentProgram() + 1, juce::dontSendNotification);
    presetBox.onChange = [this]
    {
        const int idx = presetBox.getSelectedId() - 1;
        if (idx >= 0) { proc.applyPreset (idx); lastProgram = idx; updateTip(); }
    };
    addAndMakeVisible (presetBox);

    matchButton.setTooltip ("Ajusta el drive del maximizador para llegar al objetivo LUFS. Reproduce la parte mas fuerte y pulsa 2-3 veces.");
    matchButton.onClick = [this]
    {
        const float d = proc.matchLoudnessTarget();
        statusLabel.setText (d == 0.0f ? "Reproduce audio primero (se necesitan unos segundos de medicion)."
                                       : "Drive ajustado " + juce::String (d, 1) + " dB. Deja sonar 10 s y vuelve a medir.",
                             juce::dontSendNotification);
    };
    resetButton.onClick = [this] { proc.resetLoudness(); statusLabel.setText ("Medidor reiniciado.", juce::dontSendNotification); };
    addAndMakeVisible (matchButton);
    addAndMakeVisible (resetButton);

    lufsLabel.setFont (juce::FontOptions (15.0f, juce::Font::bold));
    lufsLabel.setJustificationType (juce::Justification::centredLeft);
    addAndMakeVisible (lufsLabel);

    tipBox.setJustificationType (juce::Justification::topLeft);
    tipBox.setFont (juce::FontOptions (12.5f));
    tipBox.setColour (juce::Label::textColourId, textCol);
    tipBox.setMinimumHorizontalScale (1.0f);
    addAndMakeVisible (tipBox);
    statusLabel.setFont (juce::FontOptions (12.0f));
    statusLabel.setColour (juce::Label::textColourId, accent);
    addAndMakeVisible (statusLabel);

    // --- entrada ---
    knob ("in_gain", "Entrada");
    toggle ("hpf_on", "Pasa altos");
    knob ("hpf_freq", "Frecuencia");
    slopeBox.addItemList ({ "12 dB/oct", "24 dB/oct" }, 1);
    slopeAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (proc.apvts, "hpf_slope", slopeBox);
    addAndMakeVisible (slopeBox);

    // --- EQ ---
    toggle ("eq_on", "ON");
    knob ("eq_low_f", "Graves Hz"); knob ("eq_low_g", "Graves dB");
    knob ("eq_m1_f", "Medios 1 Hz"); knob ("eq_m1_g", "Medios 1 dB"); knob ("eq_m1_q", "Q 1");
    knob ("eq_m2_f", "Medios 2 Hz"); knob ("eq_m2_g", "Medios 2 dB"); knob ("eq_m2_q", "Q 2");
    knob ("eq_high_f", "Agudos Hz"); knob ("eq_high_g", "Agudos dB");

    // --- de-esser ---
    toggle ("ds_on", "ON");
    knob ("ds_freq", "Frecuencia"); knob ("ds_thr", "Umbral"); knob ("ds_range", "Rango");
    meterComps.add (new Meter ([this] { return proc.meters.deessGr.load(); }, true, "GR"));

    // --- compresor de pista ---
    toggle ("cp_on", "ON");
    knob ("cp_thr", "Umbral"); knob ("cp_ratio", "Ratio"); knob ("cp_att", "Ataque");
    knob ("cp_rel", "Release"); knob ("cp_makeup", "Makeup"); knob ("cp_mix", "Mezcla (paralelo)");
    toggle ("cp_side", "Sidechain externo");
    meterComps.add (new Meter ([this] { return proc.meters.compGr.load(); }, true, "GR"));

    // --- multibanda ---
    toggle ("mb_on", "ON");
    knob ("xo1", "LOW | LOW-MID"); knob ("xo2", "LOW-MID | UP-MID"); knob ("xo3", "UP-MID | HIGH");
    toggle ("low_mono", "Graves mono");
    for (int b = 0; b < MezclaMasterProcessor::numBands; ++b)
    {
        const juce::String p = "b" + juce::String (b + 1) + "_";
        knob (p + "thr", "Umbral"); knob (p + "ratio", "Ratio"); knob (p + "att", "Ataque"); knob (p + "rel", "Release");
        knob (p + "gain", "Ganancia"); knob (p + "enh", "Realce"); knob (p + "width", "Ancho");
        toggle (p + "solo", "Solo"); toggle (p + "bypass", "Bypass");
        meterComps.add (new Meter ([this, b] { return proc.meters.bandGr[(size_t) b].load(); }, true, "GR"));

        const char* names[] = { "Leve", "Adelgazar", "Cortar picos" };
        const char* tips[] = { "Rogers: compresion leve (4:1) relativa al pico actual de la banda",
                               "Rogers: adelgazar la banda (8:1), quita lodo o aspereza",
                               "Rogers: cortar picos (30:1) para subir volumen sin que se rompa" };
        for (int m = 0; m < 3; ++m)
        {
            auto* btn = macroButtons.add (new juce::TextButton (names[m]));
            btn->setTooltip (tips[m]);
            btn->onClick = [this, b, m] { proc.applyBandMacro (b, (MezclaMasterProcessor::BandMacro) m); };
            addAndMakeVisible (btn);
        }
    }

    // --- maximizador y salida ---
    toggle ("lim_on", "ON");
    knob ("lim_drive", "Drive"); knob ("lim_ceil", "Techo"); knob ("lim_rel", "Release"); knob ("lufs_target", "Objetivo LUFS");
    knob ("out_gain", "Salida");
    meterComps.add (new Meter ([this] { return proc.meters.limGr.load(); }, true, "GR"));
    meterComps.add (new Meter ([this] { return proc.meters.inL.load(); }, false, "In L"));
    meterComps.add (new Meter ([this] { return proc.meters.inR.load(); }, false, "In R"));
    meterComps.add (new Meter ([this] { return proc.meters.outL.load(); }, false, "Out L"));
    meterComps.add (new Meter ([this] { return proc.meters.outR.load(); }, false, "Out R"));
    for (auto* m : meterComps) addAndMakeVisible (m);

    lastProgram = proc.getCurrentProgram();
    updateTip();
    setSize (1200, 830);
    startTimerHz (30);
}

MezclaMasterEditor::~MezclaMasterEditor()
{
    stopTimer();
    setLookAndFeel (nullptr);
}

Knob* MezclaMasterEditor::knob (const juce::String& id, const juce::String& label)
{
    auto* kn = knobs.add (new Knob (proc.apvts, id, label));
    addAndMakeVisible (kn);
    k[id] = kn;
    return kn;
}

Toggle* MezclaMasterEditor::toggle (const juce::String& id, const juce::String& text)
{
    auto* tg = toggles.add (new Toggle (proc.apvts, id, text));
    addAndMakeVisible (tg);
    t[id] = tg;
    return tg;
}

void MezclaMasterEditor::updateTip()
{
    const auto& presets = mm::getPresets();
    const int idx = proc.getCurrentProgram();
    if (juce::isPositiveAndBelow (idx, (int) presets.size()))
        tipBox.setText (presets[(size_t) idx].name.toUpperCase() + "\n" + presets[(size_t) idx].tip, juce::dontSendNotification);
}

void MezclaMasterEditor::timerCallback()
{
    for (auto* m : meterComps) m->refresh();

    auto fmt = [] (float v) { return v < -69.0f ? juce::String ("--") : juce::String (v, 1); };
    const float target = proc.apvts.getRawParameterValue ("lufs_target")->load();
    const float integ = proc.loudness.integrated.load();
    juce::String diff;
    if (integ > -69.0f)
        diff = "   (" + juce::String (integ - target >= 0 ? "+" : "") + juce::String (integ - target, 1) + " vs objetivo)";
    lufsLabel.setText ("M " + fmt (proc.loudness.momentary.load()) + "   S " + fmt (proc.loudness.shortTerm.load())
                       + "   I " + fmt (integ) + " LUFS" + diff
                       + "   Corr " + juce::String (proc.meters.correlation.load(), 2),
                       juce::dontSendNotification);
    lufsLabel.setColour (juce::Label::textColourId, integ > -69.0f && std::abs (integ - target) <= 1.0f ? accent : textCol);

    if (proc.getCurrentProgram() != lastProgram)
    {
        lastProgram = proc.getCurrentProgram();
        presetBox.setSelectedId (lastProgram + 1, juce::dontSendNotification);
        updateTip();
    }
}

void MezclaMasterEditor::paint (juce::Graphics& g)
{
    g.fillAll (bg);
    g.setColour (textCol);
    g.setFont (juce::FontOptions (22.0f, juce::Font::bold));
    g.drawText ("MezclaMaster", 14, 10, 200, 30, juce::Justification::centredLeft);
    g.setColour (dimText);
    g.setFont (juce::FontOptions (11.0f));
    g.drawText ("mezcla + masterizacion", 16, 36, 200, 14, juce::Justification::centredLeft);

    for (const auto& s : sections)
    {
        g.setColour (panel);
        g.fillRoundedRectangle (s.area.toFloat(), 6.0f);
        g.setColour (edge);
        g.drawRoundedRectangle (s.area.toFloat().reduced (0.5f), 6.0f, 1.0f);
        g.setColour (accent);
        g.setFont (juce::FontOptions (13.0f, juce::Font::bold));
        g.drawText (s.title, s.area.getX() + 10, s.area.getY() + 4, s.area.getWidth() - 20, 18, juce::Justification::centredLeft);
    }
}

void MezclaMasterEditor::resized()
{
    sections.clear();
    auto place = [] (juce::Component* c, int x, int y, int w = knobW, int h = knobH) { c->setBounds (x, y, w, h); };
    auto section = [this] (const juce::String& title, juce::Rectangle<int> r, const juce::String& onToggle = {})
    {
        sections.push_back ({ title, r });
        if (onToggle.isNotEmpty()) t[onToggle]->setBounds (r.getRight() - 62, r.getY() + 3, 56, 20);
        return r;
    };

    // cabecera
    presetBox.setBounds (230, 14, 330, 28);
    lufsLabel.setBounds (575, 8, 450, 22);
    statusLabel.setBounds (575, 30, 450, 18);
    matchButton.setBounds (1030, 10, 160, 22);
    resetButton.setBounds (1030, 34, 160, 20);

    const int top1 = 62, h1 = 222;
    // entrada / pasa altos
    auto r = section ("ENTRADA", { 10, top1, 156, h1 });
    place (k["in_gain"], r.getX() + 8, r.getY() + 28);
    place (k["hpf_freq"], r.getX() + 80, r.getY() + 28);
    t["hpf_on"]->setBounds (r.getX() + 8, r.getY() + 122, 140, 22);
    slopeBox.setBounds (r.getX() + 10, r.getY() + 150, 136, 24);

    // EQ
    r = section ("EQ (4 bandas)", { 174, top1, 420, h1 }, "eq_on");
    {
        const int x0 = r.getX() + 6, y0 = r.getY() + 28, y1 = y0 + knobH + 6;
        const char* cols[][2] = { { "eq_low_f", "eq_low_g" }, { "eq_m1_f", "eq_m1_g" }, { "eq_m1_q", nullptr },
                                  { "eq_m2_f", "eq_m2_g" }, { "eq_m2_q", nullptr }, { "eq_high_f", "eq_high_g" } };
        for (int c = 0; c < 6; ++c)
        {
            place (k[cols[c][0]], x0 + c * 68, cols[c][1] ? y0 : y0 + knobH / 2 + 3);
            if (cols[c][1]) place (k[cols[c][1]], x0 + c * 68, y1);
        }
    }

    // de-esser
    r = section ("DE-ESSER", { 602, top1, 176, h1 }, "ds_on");
    place (k["ds_freq"], r.getX() + 8, r.getY() + 28);
    place (k["ds_thr"], r.getX() + 8, r.getY() + 28 + knobH + 6);
    place (k["ds_range"], r.getX() + 80, r.getY() + 28);
    meterComps[0]->setBounds (r.getX() + 100, r.getY() + 122, 26, 90);

    // compresor de pista
    r = section ("COMPRESOR DE PISTA", { 786, top1, 404, h1 }, "cp_on");
    {
        const int x0 = r.getX() + 8, y0 = r.getY() + 28, y1 = y0 + knobH + 6;
        place (k["cp_thr"], x0, y0); place (k["cp_ratio"], x0 + 70, y0); place (k["cp_att"], x0 + 140, y0);
        place (k["cp_rel"], x0, y1); place (k["cp_makeup"], x0 + 70, y1); place (k["cp_mix"], x0 + 140, y1, 90);
        t["cp_side"]->setBounds (x0 + 236, y0 + 4, 150, 22);
        meterComps[1]->setBounds (x0 + 330, y0 + 34, 26, 150);
    }

    // multibanda
    const int top2 = top1 + h1 + 8, h2 = 300;
    r = section ("MULTIBANDA (Rogers: LOW 20-130 | LOWER-MIDS 130-1.5k | UPPER-MIDS 1.5k-9k | HIGH 9k-20k)", { 10, top2, 1180, h2 }, "mb_on");
    {
        const int cx = r.getX() + 8, cy = r.getY() + 28;
        place (k["xo1"], cx, cy, 96); place (k["xo2"], cx, cy + knobH, 96); place (k["xo3"], cx, cy + 2 * knobH, 96);
        t["low_mono"]->setBounds (cx, cy + 3 * knobH, 110, 22);

        const char* names[] = { "LOW", "LOWER-MIDS", "UPPER-MIDS", "HIGH" };
        const int bw = 262;
        for (int b = 0; b < 4; ++b)
        {
            const int bx = r.getX() + 118 + b * (bw + 3), by = r.getY() + 26;
            sections.push_back ({ names[b], { bx, by, bw, h2 - 32 } });
            const juce::String p = "b" + juce::String (b + 1) + "_";
            const int kx = bx + 2, ky = by + 24;
            place (k[p + "thr"], kx, ky, 64); place (k[p + "ratio"], kx + 64, ky, 64); place (k[p + "att"], kx + 128, ky, 64); place (k[p + "rel"], kx + 192, ky, 64);
            place (k[p + "gain"], kx, ky + knobH + 2, 64); place (k[p + "enh"], kx + 64, ky + knobH + 2, 64); place (k[p + "width"], kx + 128, ky + knobH + 2, 64);
            meterComps[2 + b]->setBounds (kx + 218, ky + knobH + 6, 26, knobH);
            t[p + "solo"]->setBounds (kx + 6, ky + 2 * knobH + 8, 70, 22);
            t[p + "bypass"]->setBounds (kx + 90, ky + 2 * knobH + 8, 80, 22);
            for (int m = 0; m < 3; ++m)
                macroButtons[b * 3 + m]->setBounds (kx + 4 + m * 84, ky + 2 * knobH + 36, 80, 22);
        }
    }

    // maximizador
    const int top3 = top2 + h2 + 8, h3 = getHeight() - top3 - 10;
    r = section ("MAXIMIZADOR", { 10, top3, 330, h3 }, "lim_on");
    {
        const int x0 = r.getX() + 8, y0 = r.getY() + 30;
        place (k["lim_drive"], x0, y0); place (k["lim_ceil"], x0 + 70, y0); place (k["lim_rel"], x0 + 140, y0);
        place (k["lufs_target"], x0 + 70, y0 + knobH + 8, 90);
        meterComps[6]->setBounds (x0 + 270, y0 + 6, 26, 150);
    }

    r = section ("SALIDA", { 348, top3, 260, h3 });
    {
        const int x0 = r.getX() + 8, y0 = r.getY() + 30;
        place (k["out_gain"], x0, y0);
        for (int m = 0; m < 4; ++m) meterComps[7 + m]->setBounds (x0 + 86 + m * 40, y0, 30, 160);
    }

    r = section ("CONSEJO DEL PRESET (iZotope / Rogers / Wilkenfeld)", { 616, top3, 574, h3 });
    tipBox.setBounds (r.reduced (10).withTrimmedTop (18));
}
