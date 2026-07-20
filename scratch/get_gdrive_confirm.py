import urllib.request
import re

file_id = '1lAYmPAzEBosDxRhDzL0JdkjESQs7S-gW'
url = f'https://docs.google.com/uc?export=download&id={file_id}'

req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        print("Response URL:", response.geturl())
        
        # Look for confirm token in the HTML
        # Usually it is inside a form with action="/uc" or in a link
        # Form: <form action="/uc?export=download&amp;id=..." method="post">
        # Input: <input type="hidden" name="confirm" value="XXX">
        confirm_match = re.search(r'name="confirm"\s+value="([^"]+)"', html)
        if confirm_match:
            print("Found confirm token in input:", confirm_match.group(1))
        else:
            # Maybe it is in a link: href="/uc?export=download&confirm=XXX&id=..."
            confirm_link_match = re.search(r'confirm=([a-zA-Z0-9_-]+)', html)
            if confirm_link_match:
                print("Found confirm token in link:", confirm_link_match.group(1))
            else:
                print("Confirm token not found. HTML snippet:")
                print(html[:1000])
except Exception as e:
    print("Error:", e)
