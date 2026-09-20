import json
import os
import sys

import espeakng_loader

BREW_LIBRARY = '/opt/homebrew/lib/libespeak-ng.dylib'
BREW_DATA = '/opt/homebrew/share/espeak-ng-data'

if os.path.exists(BREW_DATA) and os.path.exists(BREW_LIBRARY):
    espeakng_loader.get_library_path = lambda: BREW_LIBRARY
    espeakng_loader.get_data_path = lambda: BREW_DATA

library = espeakng_loader.get_library_path()
data = espeakng_loader.get_data_path()
os.environ['ESPEAK_DATA_PATH'] = str(data)
os.environ['PHONEMIZER_ESPEAK_LIBRARY'] = str(library)

if len(str(data)) > 140:
    sys.exit(f'espeak-ng data path is too long for espeak to load: {data}')

from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(library)
EspeakWrapper.set_data_path(data)

import numpy as np
import soundfile as sf
from kokoro import KPipeline

voice = os.environ.get('KOKORO_VOICE', 'af_heart')
speed = float(os.environ.get('KOKORO_SPEED', '1.0'))
segments = json.load(open(sys.argv[1]))
out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)

pipeline = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')

for segment in segments:
    chunks = [audio for _, _, audio in pipeline(segment['say'], voice=voice, speed=speed)]
    wave = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    sf.write(f"{out_dir}/{segment['id']}.wav", wave, 24000)
    print(segment['id'], round(len(wave) / 24000, 2), flush=True)
