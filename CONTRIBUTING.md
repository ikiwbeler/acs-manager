# Panduan Kontribusi & Git Convention

Repo ini mengikuti **[Conventional Commits](https://www.conventionalcommits.org/)**.

## Format pesan commit
```
<type>(<scope opsional>): <deskripsi singkat, imperative>

[body opsional]
[footer opsional]
```

## Type yang dipakai
| type | untuk |
|------|-------|
| `feat` | fitur/kapabilitas baru (provision, virtual parameter, kolom, chart, dashboard) |
| `fix` | perbaikan bug (mis. loop too_many_commits, IP/RX tidak terbaca) |
| `docs` | dokumentasi (HANDOVER, README) |
| `build` | docker/compose/dependency |
| `chore` | housekeeping (gitignore, struktur) |
| `refactor` | ubah struktur tanpa ubah perilaku |

## Scope umum
`provisions`, `virtual-parameters`, `ui`, `dashboard`, `tools`, `docker`.

## Contoh
- `feat(virtual-parameters): tambah PONMode (GPON/EPON/XPON)`
- `fix(provisions): cegah too_many_commits pada ONU IGD-only`
- `docs: update worklog HANDOVER`

## Branch
- `main` = stabil. Kerja fitur di branch `feat/<nama>` lalu PR/merge.
