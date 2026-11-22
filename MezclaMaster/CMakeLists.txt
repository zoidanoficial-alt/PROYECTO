cmake_minimum_required(VERSION 3.22)

project(MezclaMaster VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# En macOS se compila universal (Intel + Apple Silicon).
if(APPLE)
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "" FORCE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "10.13" CACHE STRING "" FORCE)
endif()

# En Windows se enlaza el runtime de forma estatica para que el .vst3
# funcione en cualquier PC sin instalar el redistribuible de Visual C++.
if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

# --- JUCE -------------------------------------------------------------------
# Usa una copia local con -DJUCE_DIR=/ruta/a/JUCE, o se descarga sola.
set(JUCE_DIR "" CACHE PATH "Ruta a una copia local de JUCE (opcional)")
if(JUCE_DIR)
    add_subdirectory(${JUCE_DIR} juce EXCLUDE_FROM_ALL)
else()
    include(FetchContent)
    FetchContent_Declare(juce
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 8.0.4
        GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(juce)
endif()

# VST2 solo si tienes el SDK de Steinberg (ya no se distribuye).
set(VST2_SDK_DIR "" CACHE PATH "Ruta al SDK de VST2 (opcional)")
set(MM_FORMATS VST3)
if(VST2_SDK_DIR)
    juce_set_vst2_sdk_path(${VST2_SDK_DIR})
    list(APPEND MM_FORMATS VST)
endif()
if(APPLE)
    list(APPEND MM_FORMATS AU)
endif()
list(APPEND MM_FORMATS Standalone)

juce_add_plugin(MezclaMaster
    COMPANY_NAME "ZoiDan Audio"
    PLUGIN_MANUFACTURER_CODE Zoid
    PLUGIN_CODE MzMs
    FORMATS ${MM_FORMATS}
    PRODUCT_NAME "MezclaMaster"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES Fx Dynamics EQ Mastering
    AU_MAIN_TYPE kAudioUnitType_Effect)

set(MM_SOURCES
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/Presets.cpp)

target_sources(MezclaMaster PRIVATE ${MM_SOURCES})

target_compile_definitions(MezclaMaster PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(MezclaMaster
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

# --- Prueba offline del DSP (no necesita DAW) --------------------------------
option(MM_BUILD_TESTS "Compilar la prueba offline del DSP" ON)
if(MM_BUILD_TESTS)
    juce_add_console_app(MezclaMasterTest PRODUCT_NAME "MezclaMasterTest")
    target_sources(MezclaMasterTest PRIVATE tests/OfflineTest.cpp ${MM_SOURCES})
    target_include_directories(MezclaMasterTest PRIVATE Source)
    target_compile_definitions(MezclaMasterTest PRIVATE
        JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 MM_NO_PLUGIN_ENTRY=1)
    target_link_libraries(MezclaMasterTest PRIVATE
        juce::juce_audio_utils juce::juce_dsp
        juce::juce_recommended_config_flags)
endif()
