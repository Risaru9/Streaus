import urllib.request

# Test url with confirm=t
url = 'https://drive.usercontent.google.com/download?id=1lAYmPAzEBosDxRhDzL0JdkjESQs7S-gW&export=download&confirm=t'

req = urllib.request.Request(url, method='HEAD')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Headers:")
        print(response.info())
except Exception as e:
    print("Error:", e)
