# `@oak/face`

Internal Lumen rabbit face for Oak. Mounted in the side panel identity row, worker-count chip, Help guide, every Fill/Custom list-card badge, and the selection-QA chip. Toolbar icons stay still PNGs.

## API

```ts
import { mount, OAK_FACE_MODES, type OakFaceMode } from "@oak/face";

const face = mount(document.querySelector("#face")!);
face.setMode("waiting");
face.destroy();
```

Modes: `waiting` `thinking` `working` `sleeping` `smile` `wink` `sad`

One mode at a time. The head is a single path — ears do not move. No plate or rounded-rect backdrop; the silhouette fills the box. Modes drive the eyes (plus whole-head breath) and the **fur gradient**: waiting is the identity rainbow; thinking ice-blue; working ember red; sleeping dusk; smile peach-gold; wink magenta; sad drained gray. Rest eyes are round white circles (`r=21.75`). Thinking rolls both whites up and inward. Small slits follow the face line. Smile tilts `\ /`; sad tilts `/ \`. Wink closes one eye (sleeping slit) then opens it after a hold. No pupils, lids, or sockets.

## Playground

```bash
npm run dev:oak-face
```

Opens the chip board at http://localhost:5175.

Product wiring: [`docs/oak-face-moments.md`](../../docs/oak-face-moments.md).
