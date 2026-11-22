#include "Presets.h"

// Presets construidos a partir de los tres libros:
//  - John Rogers, "Audio Mastering Secrets": 4 bandas (LOW 20-130 Hz,
//    LOWER-MIDS 130-1.5k, UPPER-MIDS 1.5k-9k, HIGH 9k-20k), compresion
//    "leve" 4:1, "adelgazar" 8:1, "cortar picos" 30:1, techo -0.2 dB,
//    ancho estereo en la banda HIGH y calificaciones 1-10 por genero.
//  - iZotope, "Mixing Guide": rangos de EQ por instrumento y ratios.
//  - Roy Wilkenfeld, "25 Mixing Tips": gain staging, recortes 1-3 dB,
//    compresion paralela, sidechain, pasa altos en lo que no es bajo.

namespace mm
{
namespace
{
using Values = std::vector<std::pair<juce::String, float>>;

// Rogers califica cada genero de 1 a 10 (5 = promedio) en claridad,
// brillo, graves, compresion y ancho, mas un numero de ReplayGain.
// ReplayGain (referencia 89 dB = -18 LUFS)  =>  LUFS ~= RG - 107.
Preset genre (const juce::String& name, float clarity, float bright, float bass,
              float comp, float width, float lufs, const juce::String& tip)
{
    Values v;
    auto add = [&v] (const char* id, float x) { v.emplace_back (id, x); };

    add ("hpf_on", 1); add ("hpf_freq", 22); add ("hpf_slope", 0);
    add ("eq_on", 1);
    add ("eq_low_f", 80);    add ("eq_low_g", (bass - 5.0f) * 0.6f);
    add ("eq_m1_f", 300);    add ("eq_m1_g", -(clarity - 5.0f) * 0.6f); add ("eq_m1_q", 0.9f);
    add ("eq_m2_f", 3000);   add ("eq_m2_g", (clarity - 5.0f) * 0.4f);  add ("eq_m2_q", 0.8f);
    add ("eq_high_f", 12000); add ("eq_high_g", (bright - 5.0f) * 0.7f);

    add ("mb_on", 1);
    add ("xo1", 130); add ("xo2", 1500); add ("xo3", 9000);
    add ("low_mono", 1);

    // compresion "leve" de Rogers en todas las bandas; mas ratio con mas compresion
    const float ratio = 1.5f + comp * 0.35f;
    const float thrs[4] = { -20.0f, -22.0f, -20.0f, -26.0f };
    for (int b = 0; b < 4; ++b)
    {
        const juce::String p = "b" + juce::String (b + 1) + "_";
        v.emplace_back (p + "thr", thrs[b]);
        v.emplace_back (p + "ratio", ratio);
        v.emplace_back (p + "att", b == 0 ? 30.0f : 15.0f);
        v.emplace_back (p + "rel", b == 0 ? 200.0f : 120.0f);
    }
    // generos fuertes: "cortar picos" en UPPER-MIDS para que no se rompa a alto volumen
    if (comp >= 7.0f) { add ("b3_thr", -14); add ("b3_ratio", 12); add ("b3_att", 2); add ("b3_rel", 80); }

    add ("b1_gain", (bass - 5.0f) * 0.5f);
    add ("b1_enh", std::max (0.0f, bass - 5.0f) * 7.0f);
    add ("b2_gain", bass <= 4.0f ? 0.5f : 0.0f);
    add ("b3_enh", std::max (0.0f, bright - 5.0f) * 5.0f);
    add ("b4_gain", (bright - 5.0f) * 0.4f);
    add ("b4_enh", std::max (0.0f, bright - 5.0f) * 4.0f);

    add ("b1_width", 0);
    add ("b2_width", 100);
    add ("b3_width", 100 + (width - 5.0f) * 6.0f);
    add ("b4_width", 110 + (width - 5.0f) * 10.0f);   // Rogers: siempre un poco mas ancho el HIGH

    add ("lim_on", 1); add ("lim_drive", 4); add ("lim_ceil", -0.2f); add ("lim_rel", 80);
    add ("lufs_target", lufs);

    const juce::String full = tip
        + "\n\nCalibra: con el coro sonando pulsa Leve en cada banda (o Cortar picos en UPPER-MIDS si es un genero fuerte), "
          "luego 'Igualar LUFS' 2-3 veces. Compara siempre con una cancion de referencia y deja la decision final a tus oidos.";
    return { name, "Master", full, v };
}

Preset mix (const juce::String& name, const juce::String& tip, Values v)
{
    return { name, "Mezcla", tip, std::move (v) };
}

std::vector<Preset> build()
{
    std::vector<Preset> p;

    p.push_back ({ "Neutro (todo plano)", "General",
                   "Punto de partida sin procesamiento. Activa solo los modulos que necesites.\n"
                   "Gain staging (Wilkenfeld): deja que cada pista pico entre -6 y -20 dBFS y el master con 3-6 dB de headroom antes de masterizar (Rogers).",
                   {} });

    // ---------------------------- MASTER --------------------------------
    p.push_back (genre ("Master - Metal / Hard Rock", 5, 8, 4, 7, 7, -8.0f,
        "Rogers: claridad 5, brillo 8, graves 4 (6 en hard rock moderno con doble bombo), compresion 7, ancho 7, ReplayGain 99-99.5 (~ -8 LUFS). "
        "Brillo con mordida, no delgado. Corta picos en UPPER-MIDS para que aguante volumen."));
    p.push_back (genre ("Master - Rock clasico", 5, 5, 6, 4, 6, -10.0f,
        "Rogers: claridad 5, brillo 5, graves 6, compresion 4, ancho 6, ReplayGain 97-97.5 (~ -10 LUFS). "
        "Calidez y dinamica antes que volumen: nada de sonido digital y aplastado."));
    p.push_back (genre ("Master - Pop-Rock / Punk / Country", 6, 6, 6, 6, 7, -9.0f,
        "Rogers: claridad 6, brillo 6, graves 6 (5-7 segun la linea de bajo), compresion 6, ancho 7, ReplayGain 98-98.5 (~ -9 LUFS). "
        "La voz debe entenderse claramente."));
    p.push_back (genre ("Master - Hip-Hop / Rap / Trap", 7, 7, 9, 8, 5, -8.0f,
        "Rogers: claridad 7, brillo 7, graves 9 (el sub mas grande de todos), compresion 8, ancho 5, ReplayGain 99-99.5 (~ -8 LUFS). "
        "LOWER-MIDS discretos; voz brillante para cortar sobre el bajo."));
    p.push_back (genre ("Master - R&B", 6, 6, 7, 4, 6, -9.0f,
        "Rogers: claridad 6, brillo 6, graves 7, compresion 4, ancho 6, ReplayGain 98-98.5 (~ -9 LUFS). "
        "Bajo y bombo que se sientan sin enlodar la voz; conserva calidez."));
    p.push_back (genre ("Master - Pop / Dance / EDM", 6, 6, 6, 7, 7, -9.0f,
        "Rogers: claridad 6, brillo 6, graves 6-7 (pop-dance) o 5-6 seco y con punch (EDM), compresion 7, ancho 7, ReplayGain 98-98.5 (~ -9 LUFS). "
        "Si el sinte se vuelve 'una masa brillante', adelgaza UPPER-MIDS."));
    p.push_back (genre ("Master - Cine / Clasica / Jazz", 6, 6, 6, 4, 8, -10.0f,
        "Rogers: claridad 6, brillo 6, graves 6, compresion 4, ancho 8 (el mas ancho), ReplayGain 97 (~ -10 LUFS o menos). "
        "Prioriza el rango dinamico."));
    {
        Preset s = genre ("Master - Streaming (-14 LUFS)", 6, 6, 6, 5, 6, -14.0f,
            "Para Spotify / YouTube / Apple Music, que normalizan alrededor de -14 LUFS: no ganas nada aplastando la mezcla. "
            "Techo a -1 dB para que la conversion a MP3/AAC no sature.");
        s.values.emplace_back ("lim_ceil", -1.0f);
        s.values.emplace_back ("lim_drive", 1.0f);
        p.push_back (s);
    }

    // ---------------------------- MEZCLA --------------------------------
    p.push_back (mix ("Mezcla - Voz principal",
        "iZotope: 400-800 Hz suena a 'micro barato', 2-4 kHz nasal/presencia, aire en 15-18 kHz; compresion 2:1-5:1 para nivelar. "
        "Wilkenfeld: pasa altos subiendo desde 60 Hz hasta que la voz pierda cuerpo y regresa un poco. De-esser en 5-8 kHz.",
        { { "hpf_on", 1 }, { "hpf_freq", 90 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_low_f", 200 }, { "eq_low_g", 0 },
          { "eq_m1_f", 450 }, { "eq_m1_g", -2.5f }, { "eq_m1_q", 1.2f },
          { "eq_m2_f", 3500 }, { "eq_m2_g", 2.0f }, { "eq_m2_q", 1.0f },
          { "eq_high_f", 12000 }, { "eq_high_g", 2.5f },
          { "ds_on", 1 }, { "ds_freq", 6500 }, { "ds_thr", -30 }, { "ds_range", 6 },
          { "cp_on", 1 }, { "cp_thr", -20 }, { "cp_ratio", 4 }, { "cp_att", 10 }, { "cp_rel", 100 }, { "cp_makeup", 3 } }));

    p.push_back (mix ("Mezcla - Coros / voces dobles",
        "Mas pasa altos y menos medios que la voz principal para que no le compitan. Recorta 1-3 dB donde la voz principal tiene su presencia (Wilkenfeld).",
        { { "hpf_on", 1 }, { "hpf_freq", 150 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_m1_f", 350 }, { "eq_m1_g", -3 }, { "eq_m1_q", 1.0f },
          { "eq_m2_f", 3500 }, { "eq_m2_g", -1.5f }, { "eq_m2_q", 1.2f },
          { "eq_high_f", 11000 }, { "eq_high_g", 2 },
          { "ds_on", 1 }, { "ds_freq", 6500 }, { "ds_thr", -32 }, { "ds_range", 8 },
          { "cp_on", 1 }, { "cp_thr", -22 }, { "cp_ratio", 3 }, { "cp_att", 15 }, { "cp_rel", 120 }, { "cp_makeup", 2 } }));

    p.push_back (mix ("Mezcla - Bombo (kick)",
        "iZotope: problemas en 200-500 Hz (suena 'tubby'), 600 Hz-1 kHz (caja de carton) y 2-4 kHz (click). Pasa altos bajo 30 Hz. "
        "Si el bombo enfatiza 80 Hz, el bajo no debe hacerlo (y viceversa). Ataque lento deja pasar el golpe.",
        { { "hpf_on", 1 }, { "hpf_freq", 30 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_low_f", 60 }, { "eq_low_g", 3 },
          { "eq_m1_f", 350 }, { "eq_m1_g", -4 }, { "eq_m1_q", 1.5f },
          { "eq_m2_f", 3000 }, { "eq_m2_g", 2.5f }, { "eq_m2_q", 1.5f },
          { "eq_high_f", 10000 }, { "eq_high_g", -2 },
          { "cp_on", 1 }, { "cp_thr", -18 }, { "cp_ratio", 4 }, { "cp_att", 20 }, { "cp_rel", 80 }, { "cp_makeup", 2 } }));

    p.push_back (mix ("Mezcla - Caja (snare)",
        "iZotope: tono redondo en 200-250 Hz, punch 150-300 Hz; ratios 5:1-8:1 y release corto (hasta 20 ms) para percusion.",
        { { "hpf_on", 1 }, { "hpf_freq", 80 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_low_f", 120 }, { "eq_low_g", -1.5f },
          { "eq_m1_f", 220 }, { "eq_m1_g", 2 }, { "eq_m1_q", 1.2f },
          { "eq_m2_f", 800 }, { "eq_m2_g", -2 }, { "eq_m2_q", 1.4f },
          { "eq_high_f", 6000 }, { "eq_high_g", 2 },
          { "cp_on", 1 }, { "cp_thr", -20 }, { "cp_ratio", 6 }, { "cp_att", 8 }, { "cp_rel", 40 }, { "cp_makeup", 3 } }));

    p.push_back (mix ("Mezcla - Bajo / 808",
        "iZotope: 2-5 kHz hace que el bajo asome en una mezcla densa; ratios 3:1-6:1 y un limitador para controlar picos. "
        "Wilkenfeld: realza sub (45-55 Hz) y bajo (80-100 Hz), recorta 200-400 Hz. Graves siempre centrados.",
        { { "hpf_on", 1 }, { "hpf_freq", 28 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_low_f", 90 }, { "eq_low_g", 2 },
          { "eq_m1_f", 280 }, { "eq_m1_g", -3 }, { "eq_m1_q", 1.2f },
          { "eq_m2_f", 2500 }, { "eq_m2_g", 2.5f }, { "eq_m2_q", 1.0f },
          { "eq_high_f", 8000 }, { "eq_high_g", -2 },
          { "cp_on", 1 }, { "cp_thr", -20 }, { "cp_ratio", 4 }, { "cp_att", 10 }, { "cp_rel", 120 }, { "cp_makeup", 3 },
          { "lim_on", 1 }, { "lim_drive", 3 }, { "lim_ceil", -1 }, { "lim_rel", 60 } }));

    p.push_back (mix ("Mezcla - Bus de bateria (paralelo)",
        "Compresion paralela / New York (Wilkenfeld): ratio 20:1, ataque ~15 ms, release ~300 ms, 10-20 dB de reduccion, "
        "y mezcla 25-40 % con la senal original: punch sin perder transitorios.",
        { { "hpf_on", 1 }, { "hpf_freq", 30 }, { "hpf_slope", 0 },
          { "cp_on", 1 }, { "cp_thr", -35 }, { "cp_ratio", 20 }, { "cp_att", 15 }, { "cp_rel", 300 }, { "cp_makeup", 10 }, { "cp_mix", 35 } }));

    p.push_back (mix ("Mezcla - Guitarra electrica",
        "Pasa altos 80-120 Hz para dejar espacio al bajo/bombo. Recorta 1-3 dB en la frecuencia clave de la voz (Wilkenfeld) y quita algo de lodo en 300-500 Hz.",
        { { "hpf_on", 1 }, { "hpf_freq", 100 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_m1_f", 400 }, { "eq_m1_g", -2 }, { "eq_m1_q", 1.0f },
          { "eq_m2_f", 3000 }, { "eq_m2_g", -1.5f }, { "eq_m2_q", 1.2f },
          { "eq_high_f", 10000 }, { "eq_high_g", -1.5f },
          { "cp_on", 1 }, { "cp_thr", -20 }, { "cp_ratio", 3 }, { "cp_att", 20 }, { "cp_rel", 150 }, { "cp_makeup", 1.5f } }));

    p.push_back (mix ("Mezcla - Guitarra acustica",
        "iZotope: pasa altos entre 100-200 Hz con compresion moderada y recortes mas grandes en 4-6 kHz para que la guitarra se mueva bien junto a la voz.",
        { { "hpf_on", 1 }, { "hpf_freq", 140 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_m1_f", 250 }, { "eq_m1_g", -2 }, { "eq_m1_q", 1.0f },
          { "eq_m2_f", 5000 }, { "eq_m2_g", -3 }, { "eq_m2_q", 1.0f },
          { "eq_high_f", 12000 }, { "eq_high_g", 1.5f },
          { "cp_on", 1 }, { "cp_thr", -20 }, { "cp_ratio", 3 }, { "cp_att", 20 }, { "cp_rel", 150 }, { "cp_makeup", 2 } }));

    p.push_back (mix ("Mezcla - Piano / teclados",
        "iZotope: muy facil sobrecomprimir el piano y que 'bombee'; usa ratios bajos (hasta 2:1). Recorte suave de lodo.",
        { { "hpf_on", 1 }, { "hpf_freq", 50 }, { "hpf_slope", 0 },
          { "eq_on", 1 }, { "eq_m1_f", 300 }, { "eq_m1_g", -2 }, { "eq_m1_q", 0.9f },
          { "eq_high_f", 10000 }, { "eq_high_g", 1 },
          { "cp_on", 1 }, { "cp_thr", -18 }, { "cp_ratio", 2 }, { "cp_att", 30 }, { "cp_rel", 200 }, { "cp_makeup", 1 } }));

    p.push_back (mix ("Mezcla - Sinte / pad",
        "Wilkenfeld: todo lo que no es bajo lleva pasa altos (200-700 Hz en pads) para limpiar graves. Abre el ancho solo en medios-agudos y deja los graves en mono.",
        { { "hpf_on", 1 }, { "hpf_freq", 250 }, { "hpf_slope", 1 },
          { "eq_on", 1 }, { "eq_m1_f", 500 }, { "eq_m1_g", -2 }, { "eq_m1_q", 1.0f },
          { "eq_m2_f", 3500 }, { "eq_m2_g", -1.5f }, { "eq_m2_q", 1.0f },
          { "mb_on", 1 }, { "low_mono", 1 }, { "b3_width", 125 }, { "b4_width", 135 },
          { "b1_ratio", 1 }, { "b2_ratio", 1 }, { "b3_ratio", 1 }, { "b4_ratio", 1 } }));

    p.push_back (mix ("Mezcla - Ducking con sidechain",
        "Wilkenfeld: manda el bombo al sidechain de este plugin, ataque y release rapidos, ratio ~3:1 y 6-20 dB de reduccion. "
        "En FL Studio: en el mixer, clic derecho en la flecha del canal del bombo -> 'Sidechain to this track' y en el plugin elige la entrada lateral.",
        { { "cp_on", 1 }, { "cp_side", 1 }, { "cp_thr", -30 }, { "cp_ratio", 3 }, { "cp_att", 0.5f }, { "cp_rel", 120 }, { "cp_makeup", 0 } }));

    p.push_back (mix ("Mezcla - Bus maestro (pegamento)",
        "Wilkenfeld: compresor en el bus con ataque/release medios (30/60 ms) y solo 1-3 dB de reduccion para 'pegar' la mezcla. "
        "Deja el maximizador apagado mientras mezclas; nunca pases de 0 dB en ningun canal (Rogers).",
        { { "hpf_on", 1 }, { "hpf_freq", 22 }, { "hpf_slope", 0 },
          { "cp_on", 1 }, { "cp_thr", -16 }, { "cp_ratio", 2 }, { "cp_att", 30 }, { "cp_rel", 60 }, { "cp_makeup", 1 } }));

    return p;
}
} // namespace

const std::vector<Preset>& getPresets()
{
    static const std::vector<Preset> presets = build();
    return presets;
}
} // namespace mm
