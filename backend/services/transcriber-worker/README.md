# transcriber-worker

Phase 2 of the resilient streaming pipeline. Stateless gRPC service that owns the streaming-diarization session lifecycle so:

- A transcriber crash doesn't kill the bot's recording.
- Transcribers scale horizontally based on active sessions.
- A different transcriber pod can pick up a meeting via `Resume` if the original worker dies mid-meeting.

## Status

**Scaffold ready, full session pump TODO.** The server boots, accepts connections, and routes the bidi-streaming protocol defined in `../../proto/transcriber/v1/transcriber.proto`. The actual provider adapter logic (AssemblyAI / AWS Transcribe / Deepgram WebSocket plumbing) is the next iteration; right now the handler accepts frames and emits acks but does not produce real transcripts. This lets us land the deployment + plane-of-control in production before the migration cutover.

## Local dev

```
# Generate proto stubs
python -m grpc_tools.protoc -I ../../proto \
    --python_out=. --grpc_python_out=. \
    ../../proto/transcriber/v1/transcriber.proto

# Run
python main.py
```

Then hit `localhost:50051` with any gRPC client that speaks `transcriber.v1`.

## Deploy (TODO — Phase 2.2)

When the actual provider transcription is wired in (the next iteration), the deploy plumbing is small and additive:

1. **Copy / symlink the Dockerfile** to `infra/docker/transcriber_worker.Dockerfile`. The existing `infra/deploy.sh` build pattern is one `build_and_push <name> <dockerfile> <context>` call per service.
2. **Add to `infra/deploy.sh`**:
   - Add `transcriber-worker` to the `ALL_SERVICES` and staging service lists.
   - Add `transcriber-worker)` case to `get_folder_for_service()` mapping it to `meeting-joiner`.
   - Add a `build_and_push "transcriber-worker" "docker/transcriber_worker.Dockerfile" ".."` branch in the service-build switch.
3. **Add to `.github/workflows/deploy-staging.yml`** `FOLDER_TO_REPOS[meeting-joiner]` to include `transcriber-worker` so the same release run builds it.
4. **Create the K8s manifest** — a Deployment + Service in `infra/k8s/transcriber-worker/` so the `kubectl set image deployment/transcriber-worker` rollout step at the end of `deploy.sh` actually has a target.
5. **Update meeting-worker env** to point at the sidecar:
   ```
   STREAMING_TRANSPORT=grpc
   TRANSCRIBER_WORKER_HOST=transcriber-worker.<ns>.svc.cluster.local
   ```

This split was deliberate: the in-process Phase 1 path that ships with this PR fixes the production-blocking bugs we cared about (16-second cliff, 4-speaker bug). Migrating to the gRPC plane is a strict reliability/scale win, not an accuracy win, so it's worth keeping behind a feature flag and rolling out separately when we're ready to take on the deploy + observability work.

## Why not just keep Phase 1 in-process forever?

Phase 1 fixes the production-blocking bugs (idle WS, no reconnect) but inherits the meeting-worker's blast radius — one meeting going sideways can OOM the whole pod. Phase 2 isolates the streaming layer so transcripts survive any meeting-worker failure mode short of network partition.
