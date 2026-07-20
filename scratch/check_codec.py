import urllib.request

url = 'https://pixeldrain.com/api/file/CfPzJFE8'
req = urllib.request.Request(url, headers={'Range': 'bytes=0-10000'})
try:
    with urllib.request.urlopen(req) as response:
        chunk = response.read()
        print("Downloaded", len(chunk), "bytes")
        # Search for codec indicators in the MP4 atoms
        if b'avc1' in chunk:
            print("Detected H.264 (avc1) - Should be supported by all browsers!")
        elif b'hvc1' in chunk or b'hev1' in chunk:
            print("Detected H.265/HEVC (hvc1/hev1) - NOT supported by Chrome/Firefox by default on Windows without HEVC extension!")
        elif b'av01' in chunk:
            print("Detected AV1 (av01) - Supported by modern browsers.")
        elif b'vp09' in chunk:
            print("Detected VP9 (vp09) - Supported by most browsers.")
        else:
            print("No common codec signatures found in the first 10KB. Signatures found:")
            # Print standard signatures if visible
            for sig in [b'avc1', b'hvc1', b'hev1', b'mp42', b'isom', b'dash']:
                if sig in chunk:
                    print(sig)
except Exception as e:
    print("Error:", e)
