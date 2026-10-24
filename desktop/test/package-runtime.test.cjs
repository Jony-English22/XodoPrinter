'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ROOT_MODULES, isJdkHome, makeJlinkArgs, resolveJdkHome, buildPrivateRuntime,
} = require('../scripts/stage-runtime.cjs');
const { stagedPaths, packagedPaths } = require('../src/bundle.cjs');

function fakeJdk() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xodo-fake-jdk-'));
  fs.mkdirSync(path.join(home, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(home, 'jmods'), { recursive: true });
  for (const filename of ['java.exe', 'jlink.exe']) fs.writeFileSync(path.join(home, 'bin', filename), 'mock');
  fs.writeFileSync(path.join(home, 'jmods', 'java.base.jmod'), 'mock');
  return home;
}

test('usa un JDK con java.exe, jlink.exe y modulos, sin depender de rutas predeterminadas', () => {
  const home = fakeJdk();
  try {
    assert.equal(isJdkHome(home), true);
    assert.equal(resolveJdkHome({ JAVA_HOME: home }), home);
    fs.rmSync(path.join(home, 'jmods', 'java.base.jmod'));
    assert.equal(isJdkHome(home), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('selecciona modulos Java conservadores para el motor Spring Boot', () => {
  const args = makeJlinkArgs('C:\\JDK25', 'C:\\proyecto\\runtime');
  assert.ok(args.includes('--compress=zip-6'));
  assert.ok(args.includes('--strip-debug'));
  assert.ok(args.includes('--no-header-files'));
  assert.ok(args.includes('--no-man-pages'));
  const mods = args[args.indexOf('--add-modules') + 1].split(',');
  assert.deepEqual(mods, [...ROOT_MODULES]);
  assert.ok(mods.includes('java.se'));
  assert.ok(mods.includes('jdk.crypto.ec'));
  assert.ok(mods.includes('jdk.unsupported'));
});

test('impide construir un runtime de Windows desde un sistema distinto', () => {
  assert.throws(() => buildPrivateRuntime('/no/existe', { platform: 'linux', arch: 'x64' }), /Windows 11 x64/);
  assert.throws(() => buildPrivateRuntime('/no/existe', { platform: 'win32', arch: 'arm64' }), /Windows 11 x64/);
});

test('rutas instaladas usan resourcesPath (fuera de ASAR)', () => {
  const resources = path.join(os.tmpdir(), 'Xodo Printer Espacios', 'resources');
  const paths = packagedPaths(resources);
  assert.equal(paths.webRoot, path.join(resources, 'xodo', 'web'));
  assert.equal(paths.backendJar, path.join(resources, 'xodo', 'backend', 'xodoprinter.jar'));
  assert.equal(paths.runtimeJava, path.join(resources, 'xodo', 'runtime', 'bin', 'java.exe'));
  const dev = stagedPaths('/tmp/desktop');
  assert.match(dev.runtimeJava, /\.staged.*runtime.*java\.exe/);
});

test('electron-builder empaqueta los tres recursos por separado y no publica binarios de vendor', () => {
  const pkg = require('../package.json');
  const resourceTargets = pkg.build.extraResources.map((x) => x.to);
  assert.deepEqual(resourceTargets, ['xodo/web', 'xodo/backend/xodoprinter.jar', 'xodo/runtime']);
  assert.equal(pkg.private, true);
  assert.equal(pkg.build.asar, true);
  assert.match(pkg.scripts['package:dir'], /package:prepare/);
  assert.match(pkg.scripts['package:installer:lab'], /nsis/);
});
