title terminal for Lightgun Game
cd /d "%~dp0"
REM Start the Node server in a new window
start "Lightgun Server" cmd /k "node server.js"

REM Start ngrok in a new window to expose local HTTPS server
start "ngrok" cmd /k "ngrok http https://localhost:8080"

REM Poll the local ngrok API and write the public forwarding URL to public\\ngrok_url.txt
powershell -NoProfile -Command "$out = 'public\\ngrok_url.txt'; Write-Host 'Waiting for ngrok to create a tunnel...'; while ($true) { try { $r = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -ErrorAction Stop; if ($r.tunnels.Count -gt 0) { $t = $r.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1; if (-not $t) { $t = $r.tunnels[0] }; $u = $t.public_url; Set-Content -Path $out -Value $u; Write-Host 'NGROK URL:' $u; break } } catch { Start-Sleep -Seconds 1 } ; Start-Sleep -Seconds 1 } ; Write-Host 'ngrok url written to' $out;"