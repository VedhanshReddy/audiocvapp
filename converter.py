from pydub import AudioSegment
import sox
import sys
import os
import tempfile
from math import sin, pi

def apply_autopan(audio_segment, freq=0.08, amount=0.85):
    samples = audio_segment.get_array_of_samples()
    channels = audio_segment.channels
    rate = audio_segment.frame_rate

    if channels == 1:
        audio_segment = audio_segment.set_channels(2)

    duration = len(samples) / (rate * channels)
    chunk_size = 50  # ms
    output = AudioSegment.empty()

    for i in range(0, len(audio_segment), chunk_size):
        chunk = audio_segment[i:i+chunk_size]
        time = i / 1000
        pan_position = amount * sin(2 * pi * freq * time)
        chunk = chunk.pan(pan_position)
        output += chunk

        if i % (len(audio_segment) // 20) == 0:
            progress = 25 + ((i / len(audio_segment)) * 25)
            print(f"PROGRESS:{int(progress)}", flush=True)

    return output

def apply_reverb(audio_path, output_path):
    tfm = sox.Transformer()
    tfm.reverb(
        reverberance=50,
        high_freq_damping=50,
        room_scale=100,
        stereo_depth=100,
        pre_delay=0,
        wet_gain=0,
        wet_only=False
    )
    tfm.build(audio_path, output_path)

def process_audio(input_path, output_path):
    try:
        print("PROGRESS:0", flush=True)
        audio = AudioSegment.from_file(input_path)

        print("PROGRESS:25", flush=True)
        panned_audio = apply_autopan(audio)

        print("PROGRESS:50", flush=True)
        temp_path = tempfile.mktemp('.wav')
        panned_audio.export(temp_path, format='wav')

        print("PROGRESS:75", flush=True)
        apply_reverb(temp_path, output_path)

        os.remove(temp_path)
        print("PROGRESS:100", flush=True)
        return True

    except Exception as e:
        print(f"ERROR:{str(e)}", flush=True)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python converter.py <input_file> <output_file>", flush=True)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found", flush=True)
        sys.exit(1)

    process_audio(input_file, output_file)
