# Patches

`react-native-incall-manager+4.3.0.patch` is the incall-manager change that adds
iOS audio routes (`chooseAudioRoute`, `getAudioDeviceStatus`,
`onAudioDeviceChanged`), as a [patch-package](https://github.com/ds300/patch-package)
patch over incall-manager 4.3.0. The README's "Audio routes on iOS" section says
how to apply it.

It is generated, not edited. Source: branch `ios-audio-routes` of
https://github.com/mjerris/react-native-incall-manager (proposed upstream), at:

    source-commit: ad7ca22941c7bf8c00bb73dc8f6f1c10a6d631fe

To regenerate it after a change on that branch, or to check that it still
matches, point the script at a clone of that repository:

    node scripts/check-incall-patch.mjs /path/to/react-native-incall-manager                # check
    node scripts/check-incall-patch.mjs /path/to/react-native-incall-manager --write        # regenerate
    node scripts/check-incall-patch.mjs /path/to/react-native-incall-manager --write <ref>  # from <ref>

It diffs the commit above (or, with `--write`, the head of `ios-audio-routes`,
recording that commit here) against its merge-base with the `4.3.0` tag, so an
upstream `master` that has moved past the release changes nothing. The branch
is the local one if the clone has it, else `origin/ios-audio-routes` (a fresh
clone has only that), else the one remote that has it; pass a ref to choose.
The diff ignores your git config (global and system config are not read, and
every diff setting a repository's config could change is given explicitly),
so the bytes are the same for everyone. It is not part of `npm run verify`,
which has no incall-manager clone to compare against.

## `@signalwire+js+4.0.0-rc.5.patch` (repository root `patches/`)

Two fixes to `WebRTCCall` in @signalwire/js 4.0.0-rc.5 (`dist/index.mjs` and
`dist/index.cjs`), found while building call waiting, applied to this
repository by the root `postinstall` (patch-package). Apps that hold calls
need it too (see the README, "Call waiting"). Reported to the SDK owner.

- `toggleHold()` only sent `verto.modify`: the server stopped its media to the
  held call, but the device kept sending its microphone. The patch sets
  `RTCRtpEncodingParameters.active = false` on the main peer connection's
  senders while held (no RTP, no renegotiation; `replaceTrack(null)` was not
  enough, an audio sender without a track still sends silence), and back on
  unhold.
- The stats monitor reports `no_inbound_audio` for a held call, and the
  recovery manager ran ICE restarts against it. The patch drops recovery
  triggers while held and for 5 s after unhold.

`scripts/sdk-hold-patch.test.mjs` (in `npm test`) checks that the installed
SDK is rc.5 with both fixes, and runs the patched `toggleHold()` against a
stub peer connection. It fails if the patch did not apply. Drop the patch once
the SDK fixes both.

## `react-native+0.81.5.patch` (repository root `patches/`)

> **Local test builds only. Not for any PR.** This branch (`fix/rn-textinput-drop`) is
> not proposed to this repository: carrying the patch would make every user of the
> example build React Native from source. The fix is going to React Native upstream
> instead. It was merged into `combined/all` (#54) and reverted there (`b7b62aa`,
> `c547a6e`). Our device and Simulator harness applies this branch's patch, and the
> source-build settings, to its own build at build time; the committed example
> stays on the prebuilt React Native.

A fix to React Native's New Architecture TextInput on iOS
(`RCTTextInputComponentView.mm`), applied by the root `postinstall`
(patch-package). It is
[react/react-native#58904](https://github.com/react/react-native/issues/58904),
open and unfixed up to 0.88.0.

The keys typed right after the first character of an empty TextInput could be
lost: XCUITest's `typeText("/private/rn-device-test")` into the example's
address field gave "/vate/..." or "/ivate/..." (on an iPhone up to 5 in 20
first tries, on the iOS 27 Simulator 14 in 20). A string with no "/" lost the
same way, right after its first character. The mechanism, from logs of the
native calls:

1. The first character goes to JS as state with its attributes at that
   moment, UIKit's typing font and color.
2. UIKit then gives the character the field's other attributes (paragraph
   style, background color, React Native's event emitter).
3. When that state comes back, `updateState:` compares it with the field,
   attributes included, sees a change, and writes the text back
   (`_setAttributedString:`) into the focused field.
4. Inside that `setAttributedText:`, UIKit delivers the keystrokes queued
   behind it. `textInputDidChange` ignores them (`_comingFromJS`), and the
   write then replaces them.

The patch is the 0.81.5 port of the upstream branch
(`mjerris/react-native` `fix/textinput-state-echo-drops-keys`; see
`prs/upstream-rn-58904-textinput-echo.md` in our notes). It has two parts:

1. `updateState:` skips the write when the field already shows the state's
   text: the same characters, and either the state is the view's own echo
   (`_lastStringStateWasUpdatedWith`) or `RCTTextInputTextShowsAttributedString`
   (in `RCTTextInputUtils`) finds every attribute the state sets in the field
   and every attribute only the field has a default. Paragraph styles are
   compared as UIKit shows them (its line break mode, a resolved writing
   direction, no line height in a single-line field). This covers
   uncontrolled and controlled inputs, including `lineHeight`.
2. A write that is still needed (JS restyles the text, e.g. a nested
   `<Text>`, or transforms it, e.g. upper-casing) no longer loses the keys
   UIKit delivers inside it: `textInputDidChange` records the text typed
   during the write, and `_restoreTextTypedDuringUpdateFromJS:` applies that
   edit to JS's text (an insertion only, if JS changed the characters) and
   reports it to JS as typing, so JS can still change or reject it.

Results (iOS Simulator, XCUITest `typeText`, fresh field each round) are in
the upstream draft: the issue's reproducer, controlled, multiline, nested
`<Text>`, transforms, IME composition, paste, emoji, selection, undo, RTL,
`letterSpacing`, alignment, Dynamic Type, secure entry, long text.

`scripts/rn-textinput-patch.test.mjs` (in `npm test`) checks that the
installed React Native is 0.81.5 with the fix. On this branch the example's
`withReactNativeFromSource` plugin builds React Native from source; its fmt
C++17 block lands before `react_native_post_install`, which sets C++20 on
every pod, so with Xcode 26.4+ that build fails in fmt. Our harness does not
use the plugin (it edits the Podfile itself, after `react_native_post_install`).
Drop the patch once React Native ships a fix.
