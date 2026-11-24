#!/usr/bin/env node
/**
 * Operator-only password recovery; requires write access to the persistent data
 * directory.
 */
import {resetAdminPassword} from '../server/services/auth.js';
try {
  const result = await resetAdminPassword();
  console.log(`Neues Startpasswort fuer ${result.username}: ${result.password}`);
  console.log('Dieses Passwort muss bei der naechsten Anmeldung geaendert werden.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
