# Genera un WAV por cada línea de narración usando las voces OneCore de Windows.
# Uso: powershell -File tts.ps1 -Json audio\textos.json -OutDir audio -Voice Laura
param(
  [string]$Json,
  [string]$OutDir,
  [string]$Voice = "Laura",
  [double]$Rate = 1.0
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, [Type]$t) {
  $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op))
  $task.Wait() | Out-Null
  $task.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$Voice*" } | Select-Object -First 1
if (-not $v) { throw "No encontré la voz $Voice" }
$synth.Voice = $v
$synth.Options.SpeakingRate = $Rate

New-Item -ItemType Directory -Force $OutDir | Out-Null
$items = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
foreach ($it in $items) {
  $stream = Await ($synth.SynthesizeTextToStreamAsync($it.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $size = [uint32]$stream.Size
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $null = Await ($reader.LoadAsync($size)) ([uint32])
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [System.IO.File]::WriteAllBytes((Join-Path $OutDir ($it.file)), $bytes)
  Write-Output "ok $($it.file)"
}
