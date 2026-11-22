#pragma once

// Bloques DSP de MezclaMaster. Sin asignaciones de memoria en el hilo de audio.

#include <juce_dsp/juce_dsp.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <vector>

namespace mm
{
inline float dbToGain (float db) noexcept   { return std::pow (10.0f, db * 0.05f); }
inline float gainToDb (float g) noexcept    { return 20.0f * std::log10 (std::max (g, 1.0e-9f)); }
inline float msToCoef (float ms, double sr) noexcept
{
    return (float) std::exp (-1.0 / (std::max (0.01, (double) ms) * 0.001 * sr));
}

//==============================================================================
// Compresor feed-forward con rodilla suave. El detector se comparte entre
// canales (estereo enlazado) para no mover la imagen.
class Compressor
{
public:
    void prepare (double sampleRate) { sr = sampleRate; reset(); }
    void reset() { grDb = 0.0f; }

    void setParams (float thresholdDb, float ratio, float attackMs, float releaseMs, float kneeDb = 6.0f)
    {
        thr   = thresholdDb;
        slope = 1.0f - 1.0f / std::max (1.0f, ratio);
        knee  = std::max (0.01f, kneeDb);
        att   = msToCoef (attackMs, sr);
        rel   = msToCoef (releaseMs, sr);
    }

    // level = valor absoluto del detector. Devuelve la ganancia lineal a aplicar.
    float process (float level) noexcept
    {
        const float x    = gainToDb (level);
        const float over = x - thr;
        float target = 0.0f;
        if (2.0f * over <= -knee)          target = 0.0f;
        else if (2.0f * over >= knee)      target = slope * over;
        else { const float t = over + knee * 0.5f; target = slope * t * t / (2.0f * knee); }

        const float c = target > grDb ? att : rel;
        grDb = target + c * (grDb - target);
        return dbToGain (-grDb);
    }

    float getGainReductionDb() const noexcept { return grDb; }

private:
    double sr = 44100.0;
    float thr = 0.0f, slope = 0.0f, knee = 6.0f, att = 0.0f, rel = 0.0f;
    float grDb = 0.0f;
};

//==============================================================================
// "Realce espectral": agrega armonicos (pares + impares) a una banda.
// Es el equivalente del Spectral Enhancer que usa John Rogers para dar
// brillo, cuerpo o "boominess" a una banda concreta.
class Enhancer
{
public:
    void prepare (double sampleRate)
    {
        dcCoef = (float) std::exp (-2.0 * juce::MathConstants<double>::pi * 15.0 / sampleRate);
        reset();
    }
    void reset() { dcX.fill (0.0f); dcY.fill (0.0f); }

    float process (int ch, float x, float amount) noexcept
    {
        if (amount <= 0.0f) return x;
        constexpr float a = 3.0f;
        const float odd  = x - std::tanh (a * x) / a;   // 3er armonico (brillo/mordida)
        const float even = x * x;                       // 2o armonico (calidez)
        // bloqueo de DC para la parte par
        const float y = even - dcX[(size_t) ch] + dcCoef * dcY[(size_t) ch];
        dcX[(size_t) ch] = even; dcY[(size_t) ch] = y;
        return x + amount * (1.2f * odd + 0.6f * y);
    }

private:
    float dcCoef = 0.999f;
    std::array<float, 2> dcX {}, dcY {};
};

//==============================================================================
// Limitador / maximizador con lookahead (1.5 ms). Garantiza que ninguna
// muestra supere el techo: retencion de minimo + filtro de caja de la
// misma longitud que el retardo, mas un recorte de seguridad final.
class Limiter
{
public:
    void prepare (double sampleRate)
    {
        sr = sampleRate;
        L = std::max (1, (int) std::round (0.0015 * sampleRate));
        delay[0].assign ((size_t) L, 0.0f);
        delay[1].assign ((size_t) L, 0.0f);
        hold.assign ((size_t) L + 1, 1.0f);
        box.assign ((size_t) L, 1.0f);
        reset();
    }

    void reset()
    {
        for (auto& d : delay) std::fill (d.begin(), d.end(), 0.0f);
        std::fill (hold.begin(), hold.end(), 1.0f);
        std::fill (box.begin(), box.end(), 1.0f);
        boxSum = (double) L; relEnv = 1.0f; dPos = hPos = bPos = 0; lastGain = 1.0f; counter = 0;
    }

    int getLatency() const noexcept { return L; }

    void setParams (float ceilingDb, float releaseMs)
    {
        ceiling = dbToGain (ceilingDb);
        relCoef = msToCoef (releaseMs, sr);
    }

    void process (float& l, float& r) noexcept
    {
        const float peak = std::max (std::abs (l), std::abs (r));
        const float t = peak > ceiling ? ceiling / peak : 1.0f;

        relEnv = t < relEnv ? t : t + relCoef * (relEnv - t);

        hold[(size_t) hPos] = relEnv;
        hPos = (hPos + 1) % (L + 1);
        float h = 1.0f;
        for (float v : hold) h = std::min (h, v);

        boxSum += (double) h - (double) box[(size_t) bPos];
        box[(size_t) bPos] = h;
        bPos = (bPos + 1) % L;
        if (++counter >= 4096) { counter = 0; boxSum = 0; for (float v : box) boxSum += v; }
        const float g = std::min (1.0f, (float) (boxSum / L));

        const float dl = delay[0][(size_t) dPos], dr = delay[1][(size_t) dPos];
        delay[0][(size_t) dPos] = l; delay[1][(size_t) dPos] = r;
        dPos = (dPos + 1) % L;

        l = juce::jlimit (-ceiling, ceiling, dl * g);
        r = juce::jlimit (-ceiling, ceiling, dr * g);
        lastGain = std::min (lastGain, g);
    }

    // Devuelve la ganancia minima desde la ultima lectura (para medidores).
    float takeMinGain() noexcept { const float g = lastGain; lastGain = 1.0f; return g; }

private:
    double sr = 44100.0;
    int L = 64, dPos = 0, hPos = 0, bPos = 0, counter = 0;
    std::array<std::vector<float>, 2> delay;
    std::vector<float> hold, box;
    double boxSum = 64.0;
    float relEnv = 1.0f, relCoef = 0.0f, ceiling = 1.0f, lastGain = 1.0f;
};

//==============================================================================
// Medidor de sonoridad ITU-R BS.1770 / EBU R128 (LUFS momentaneo, corto
// plazo e integrado con compuertas absoluta -70 y relativa -10).
class LoudnessMeter
{
public:
    void prepare (double sampleRate)
    {
        sr = sampleRate;
        designKWeighting();
        blockLen = std::max (1, (int) std::round (sampleRate * 0.1));
        reset();
    }

    void reset()
    {
        for (auto& c : st) c = {};
        blockAcc = 0.0; blockCount = 0;
        ring.fill (0.0); ringPos = 0; ringFilled = 0;
        hist.fill (0); histE.fill (0.0);
        momentary.store (-100.0f); shortTerm.store (-100.0f); integrated.store (-100.0f);
    }

    void process (float l, float r) noexcept
    {
        const double kl = kweight (0, l), kr = kweight (1, r);
        blockAcc += kl * kl + kr * kr;
        if (++blockCount >= blockLen)
        {
            pushBlock (blockAcc / blockCount);
            blockAcc = 0.0; blockCount = 0;
        }
    }

    std::atomic<float> momentary { -100.0f }, shortTerm { -100.0f }, integrated { -100.0f };

private:
    struct Biquad { double b0, b1, b2, a1, a2; };
    struct State  { double x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0; };

    static double toLufs (double e) { return e > 0.0 ? -0.691 + 10.0 * std::log10 (e) : -100.0; }

    void designKWeighting()
    {
        const double pi = juce::MathConstants<double>::pi;
        { // estado 1: shelf de agudos (modelo de la cabeza)
            const double G = 3.999843853973347, Q = 0.7071752369554196, fc = 1681.974450955533;
            const double A = std::pow (10.0, G / 40.0), w0 = 2.0 * pi * fc / sr;
            const double cs = std::cos (w0), alpha = std::sin (w0) / (2.0 * Q), sa = 2.0 * std::sqrt (A) * alpha;
            const double a0 = (A + 1) - (A - 1) * cs + sa;
            s1 = { A * ((A + 1) + (A - 1) * cs + sa) / a0, -2 * A * ((A - 1) + (A + 1) * cs) / a0,
                   A * ((A + 1) + (A - 1) * cs - sa) / a0, 2 * ((A - 1) - (A + 1) * cs) / a0,
                   ((A + 1) - (A - 1) * cs - sa) / a0 };
        }
        { // estado 2: pasa altos RLB
            const double Q = 0.5003270373238773, fc = 38.13547087602444, w0 = 2.0 * pi * fc / sr;
            const double cs = std::cos (w0), alpha = std::sin (w0) / (2.0 * Q), a0 = 1 + alpha;
            s2 = { (1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, -2 * cs / a0, (1 - alpha) / a0 };
        }
    }

    double kweight (int ch, float in) noexcept
    {
        auto& s = st[(size_t) ch];
        const double x = in;
        const double y = s1.b0 * x + s1.b1 * s.x1 + s1.b2 * s.x2 - s1.a1 * s.y1 - s1.a2 * s.y2;
        s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
        const double z = s2.b0 * y + s2.b1 * s.u1 + s2.b2 * s.u2 - s2.a1 * s.v1 - s2.a2 * s.v2;
        s.u2 = s.u1; s.u1 = y; s.v2 = s.v1; s.v1 = z;
        return z;
    }

    void pushBlock (double e) noexcept
    {
        ring[(size_t) ringPos] = e;
        ringPos = (ringPos + 1) % (int) ring.size();
        ringFilled = std::min (ringFilled + 1, (int) ring.size());

        auto meanLast = [this] (int n)
        {
            n = std::min (n, ringFilled);
            double s = 0;
            for (int i = 1; i <= n; ++i) s += ring[(size_t) ((ringPos - i + (int) ring.size()) % (int) ring.size())];
            return n > 0 ? s / n : 0.0;
        };

        const double m = meanLast (4);
        momentary.store ((float) toLufs (m));
        shortTerm.store ((float) toLufs (meanLast (30)));

        if (ringFilled >= 4)
        {
            const double lm = toLufs (m);
            if (lm > -70.0)
            {
                const int bin = juce::jlimit (0, (int) hist.size() - 1, (int) ((lm + 70.0) * 10.0));
                hist[(size_t) bin]++; histE[(size_t) bin] += m;
            }
            // compuerta relativa
            double sumE = 0; long long n = 0;
            for (size_t i = 0; i < hist.size(); ++i) { sumE += histE[i]; n += hist[i]; }
            if (n > 0)
            {
                const double gate = toLufs (sumE / (double) n) - 10.0;
                const int gateBin = juce::jlimit (0, (int) hist.size(), (int) std::ceil ((gate + 70.0) * 10.0));
                double s = 0; long long c = 0;
                for (size_t i = (size_t) gateBin; i < hist.size(); ++i) { s += histE[i]; c += hist[i]; }
                integrated.store (c > 0 ? (float) toLufs (s / (double) c) : -100.0f);
            }
        }
    }

    double sr = 44100.0;
    Biquad s1 {}, s2 {};
    std::array<State, 2> st {};
    int blockLen = 4410, blockCount = 0;
    double blockAcc = 0.0;
    std::array<double, 30> ring {};
    int ringPos = 0, ringFilled = 0;
    std::array<long long, 800> hist {};
    std::array<double, 800> histE {};
};

} // namespace mm
