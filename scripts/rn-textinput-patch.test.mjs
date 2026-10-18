// The react-native TextInput patch (patches/react-native+0.81.5.patch, react/react-native#58904) is
// applied by the root postinstall (patch-package), and reaches the iOS app because the example builds
// React Native from source (example/plugins/withReactNativeFromSource.js). See docs/patches/README.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'example', 'package.json'));
const rnDir = dirname(require.resolve('react-native/package.json'));
const SOURCE = 'React/Fabric/Mounting/ComponentViews/TextInput/RCTTextInputComponentView.mm';

test('the patch matches the installed react-native', () => {
  const { version } = JSON.parse(readFileSync(join(rnDir, 'package.json'), 'utf8'));
  assert.equal(version, '0.81.5', 'a new React Native: check react/react-native#58904, then regenerate or drop the patch and the plugin');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.postinstall, 'patch-package');
});

test('updateState: skips text the field already shows, and keeps keys typed during a write', () => {
  const source = readFileSync(join(rnDir, SOURCE), 'utf8');
  const updateState = source.slice(source.indexOf('- (void)updateState:'), source.indexOf('- (void)updateLayoutMetrics:'));
  assert.match(updateState, /attributedString == _lastStringStateWasUpdatedWith &&/);
  assert.match(updateState, /\[self _setAttributedStringFromJS:attributedString\];/);
  // -_textOf:equals: ignores what UIKit adds to typed text: the input's default attributes, and for a single-line field
  // the line height and writing direction.
  assert.match(source, /RCTIsAttributedStringEffectivelySame\(\s*newText, oldText, \[self _insensitiveAttributes\], props\.textAttributes, !props\.multiline\)/);
  assert.match(source, /\[self _restoreTextTypedDuringUpdateFromJS:textBeforeUpdate writtenText:attributedString\.string\];/);
  assert.match(source, /RCTTextInputTextToRestore\(textBeforeUpdate, typedText, writtenText, &replaced, &inserted\)/);
  // A controlled value JS changed is written by the setTextAndSelection command: it keeps the keys too.
  const command = source.slice(source.indexOf('- (void)setTextAndSelection:'));
  assert.match(command.slice(0, command.indexOf('\n}\n')), /\[self _restoreTextTypedDuringUpdateFromJS:textBeforeUpdate writtenText:writtenText\];/);
  // Only a key that went through -textInputShouldChangeText:inRange: is recorded (a text view also reports the write
  // itself), restored keys respect maxLength, and marked text is not restored.
  assert.match(source, /_keyTypedDuringUpdateFromJS = YES;/);
  assert.match(source, /RCTTextInputTextWithinLength\(\s*inserted,/);
  assert.match(source, /_backedTextInputView\.markedTextRange != nil/);
  const utils = readFileSync(join(rnDir, 'React/Fabric/Mounting/ComponentViews/TextInput/RCTTextInputUtils.mm'), 'utf8');
  assert.match(utils, /NSRange RCTTextInputChangedRange\(/);
  assert.match(utils, /BOOL RCTTextInputTextToRestore\(/);
  assert.match(utils, /RCTTextInputTextWithinLength\(NSString \*text, NSInteger allowedLength\)/);
  const attributed = readFileSync(
    join(rnDir, 'ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/RCTAttributedTextUtils.mm'),
    'utf8'
  );
  assert.match(attributed, /adjustedStyle2\.lineBreakMode = style1\.lineBreakMode;/);
});

test('the example builds React Native from source, so the patch reaches iOS', () => {
  const app = JSON.parse(readFileSync(join(root, 'example', 'app.json'), 'utf8'));
  assert.ok(app.expo.plugins.includes('./plugins/withReactNativeFromSource'));
  assert.equal(app.expo.newArchEnabled, true, 'the bug and the patch are in the New Architecture TextInput');
});
