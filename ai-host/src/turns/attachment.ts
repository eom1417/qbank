import { ChatImageAttachment } from '@t3tools/contracts';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Path from 'effect/Path';
import * as Schema from 'effect/Schema';

import { createAttachmentId } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/attachmentStore.ts';
import * as ServerConfig from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/config.ts';

/** Saves a page image where the kit's adapters read attachments, and describes it as one. */
export const storeImage = Effect.fn('storeImage')(function* (threadId: string, png: Uint8Array) {
  const { attachmentsDir } = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const id = createAttachmentId(threadId, 'png');
  if (!id) return yield* Effect.die(new Error('could not name the attachment'));
  yield* fs.makeDirectory(attachmentsDir, { recursive: true });
  yield* fs.writeFile(path.join(attachmentsDir, `${id}.png`), png);
  return yield* Schema.decodeEffect(ChatImageAttachment)({
    type: 'image',
    id,
    name: 'page.png',
    mimeType: 'image/png',
    sizeBytes: png.byteLength,
  });
});
