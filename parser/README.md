# Immortal+ replay parser (fork of odota/parser)

Vendored from [odota/parser](https://github.com/odota/parser) (Java, built on
[skadistats/clarity](https://github.com/skadistats/clarity)) with one patch:
the per-second `interval` entry now also reports each hero's real current
and max HP/Mana, read directly off the hero entity the same way
`life_state` already is.

## Why

Upstream's `interval` entries have `x`/`y`/`level`/`gold`/`life_state`/etc,
but no health or mana field, so HP/Mana could previously only be
*reconstructed* from combat-log damage/heal instances — which misses mana
spent on ability casts entirely (no combat-log event exists for that).

`m_iHealth`/`m_iMaxHealth`/`m_flMana`/`m_flMaxMana` are real, directly
readable per-hero entity properties — confirmed against clarity's own
`dumpmana` example and other public replay-parsing projects that already
read these exact fields. `getEntityProperty()` (in `Parse.java`) is a
generic property-by-name lookup already used for `life_state`; these are
just four more calls through the same mechanism.

## The patch

`src/main/java/opendota/Entry.java` — four new fields:

```java
public Integer hp;
public Integer max_hp;
public Float mana;
public Float max_mana;
```

`src/main/java/opendota/Parse.java` — right next to the existing
`entry.life_state = getEntityProperty(e, "m_lifeState", null);` in the
interval-entry builder:

```java
entry.hp = getEntityProperty(e, "m_iHealth", null);
entry.max_hp = getEntityProperty(e, "m_iMaxHealth", null);
entry.mana = getEntityProperty(e, "m_flMana", null);
entry.max_mana = getEntityProperty(e, "m_flMaxMana", null);
```

Everything else is unmodified upstream source. Re-sync by diffing against
a fresh `git clone https://github.com/odota/parser` and re-applying this
same four-field patch.

Built and published as `ghcr.io/hu1k1e/immortalplus-parser` by
`.github/workflows/docker-build.yml`, referenced by the app's
`docker-compose.yml` in place of the upstream `odota/parser:latest` image.
