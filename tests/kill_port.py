import subprocess
import os

result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
for line in result.stdout.split('\n'):
    if ':8001' in line:
        parts = line.split()
        pid = parts[-1]
        print(f"Killing PID {pid}")
        try:
            os.system(f'taskkill /F /PID {pid}')
        except:
            pass