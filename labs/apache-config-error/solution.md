# apache-config-error — Solution

## ROOT CAUSE

`seed.sh` drops `/etc/apache2/conf-enabled/winlab.conf` with a typo on line 2:

```
ServerNaame web01.lab.internal
```

`ServerNaame` is not a valid Apache directive. Apache2 exits with:

```
AH00526: Syntax error on line 2 of /etc/apache2/conf-enabled/winlab.conf:
Invalid command 'ServerNaame', perhaps misspelled or defined by a module not included in the server configuration
```

apache2 is left stopped.

## DIAGNOSTIC COMMANDS

```bash
# test the config — shows the exact file and line
apache2ctl configtest

# read the broken file
cat /etc/apache2/conf-enabled/winlab.conf
```

## FIX

```bash
# fix the typo
sed -i 's/ServerNaame/ServerName/' /etc/apache2/conf-enabled/winlab.conf

# validate
apache2ctl configtest

# start
apache2ctl start
```

## VERIFY LOGIC

`verify.sh` passes when:
1. `apache2ctl configtest` exits 0 (Syntax OK)
2. `pgrep apache2` finds a running process

## LESSON

> Always run `apachectl configtest` before restarting Apache in production.
> A single typo in any included config file prevents the entire server from starting.

## MENTOR_HINTS

1. Apache is down → test the config: apache2ctl configtest
2. Config test fails → read the broken file: cat /etc/apache2/conf-enabled/winlab.conf
3. Typo found → fix it: sed -i 's/ServerNaame/ServerName/' /etc/apache2/conf-enabled/winlab.conf
4. Fix → validate and start: apache2ctl configtest && apache2ctl start
