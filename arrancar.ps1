# Arranca la aplicación en modo desarrollo (pnpm dev) en el puerto 7332.
# Si ya hay un node escuchando en ese puerto (por ejemplo, una instancia colgada), lo mata antes.
# Si lo ocupa otro programa, avisa y no lo toca.

$ErrorActionPreference = 'Stop'
$Port = 7332

Set-Location -LiteralPath $PSScriptRoot

function Get-PortOwners {
	Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
		Select-Object -ExpandProperty OwningProcess -Unique
}

$owners = @(Get-PortOwners)

foreach ($ownerPid in $owners) {
	$proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
	if (-not $proc) { continue }

	if ($proc.ProcessName -ne 'node') {
		Write-Host "El puerto $Port lo ocupa '$($proc.ProcessName)' (PID $ownerPid), que no es node. No lo toco." -ForegroundColor Red
		exit 1
	}

	Write-Host "Hay un node (PID $ownerPid) escuchando en el puerto $Port. Lo mato." -ForegroundColor Yellow
	Stop-Process -Id $ownerPid -Force
}

if ($owners.Count -gt 0) {
	$limite = (Get-Date).AddSeconds(10)
	while (@(Get-PortOwners).Count -gt 0) {
		if ((Get-Date) -gt $limite) {
			Write-Host "El puerto $Port sigue ocupado tras 10 s. Aborto." -ForegroundColor Red
			exit 1
		}
		Start-Sleep -Milliseconds 300
	}
	Write-Host "Puerto $Port libre." -ForegroundColor Green
}

Write-Host "Arrancando en http://localhost:$Port ..." -ForegroundColor Cyan
pnpm dev --port $Port --strictPort
exit $LASTEXITCODE
