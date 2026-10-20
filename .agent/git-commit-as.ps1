param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("mohamed-mahmoud", "mohamed-ashraf", "omar-mohamed", "omar-khaled", "ali-raslan")]
    [string]$Agent,

    [Parameter(Mandatory=$true)]
    [string]$Message,

    [switch]$Push
)

$OriginalUser = "ZiadMD"
$OriginalEmail = "ziadmohamedgamal25@gmail.com"

$Agents = @{
    "mohamed-mahmoud" = @{ Name = "mohamed1102005"; Email = "m7md1102005@gmail.com" }
    "mohamed-ashraf"  = @{ Name = "mohamedashraff8"; Email = "mohamedashraff8@users.noreply.github.com" }
    "omar-mohamed"    = @{ Name = "om429810-gif"; Email = "om429810-gif@users.noreply.github.com" }
    "omar-khaled"     = @{ Name = "omarkhaledd22222-del"; Email = "omarkhaledd22222-del@users.noreply.github.com" }
    "ali-raslan"      = @{ Name = "aliraslan"; Email = "aliraslan@users.noreply.github.com" }
}

$Target = $Agents[$Agent]
if (-not $Target) {
    Write-Error "Unknown agent: $Agent"
    exit 1
}

Write-Host "Configuring Git author as $($Target.Name) <$($Target.Email)>..."
git config user.name "$($Target.Name)"
git config user.email "$($Target.Email)"

try {
    Write-Host "Committing changes..."
    git commit -m "$Message"

    if ($Push) {
        Write-Host "Pushing to remote origin..."
        git push origin main
    }
}
finally {
    Write-Host "Restoring original Git config: $OriginalUser <$OriginalEmail>..."
    git config user.name "$OriginalUser"
    git config user.email "$OriginalEmail"
    Write-Host "Git config restored successfully."
}
