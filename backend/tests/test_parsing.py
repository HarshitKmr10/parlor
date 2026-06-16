

def parse_processor_output(output: str):
    try:
        # Look for specific output patterns
        video_link = None
        transcript_link = None
        message = "Meeting processed"
        join_failed = False

        lines = output.split("\n")
        for line in lines:
            line_lower = line.lower()

            # Case-insensitive parsing for video links
            if "video available at:" in line_lower:
                # Find the actual case in the original line
                idx = line_lower.find("video available at:")
                if idx != -1:
                    video_link = line[idx + len("video available at:") :].strip()
            elif "🎥 video link:" in line_lower:
                idx = line_lower.find("🎥 video link:")
                if idx != -1:
                    video_link = line[idx + len("🎥 video link:") :].strip()

            # Case-insensitive parsing for transcript links
            elif "transcript available at:" in line_lower:
                idx = line_lower.find("transcript available at:")
                if idx != -1:
                    transcript_link = line[
                        idx + len("transcript available at:") :
                    ].strip()
            elif "📝 transcript link:" in line_lower:
                idx = line_lower.find("📝 transcript link:")
                if idx != -1:
                    transcript_link = line[idx + len("📝 transcript link:") :].strip()

            # Meeting completion message
            elif "meeting processing completed:" in line_lower:
                idx = line_lower.find("meeting processing completed:")
                if idx != -1:
                    message = line[idx + len("meeting processing completed:") :].strip()

        result = {
            "message": message,
            "videoLink": video_link,
            "mappedTranscriptLink": transcript_link,
        }

        return result

    except Exception as e:
        print(f"Failed to parse processor output: {e}")
        return {
            "message": "Processing completed (parse error)",
            "videoLink": None,
            "mappedTranscriptLink": None,
        }


# Test with actual output from logs
test_output = """Processing meeting: e4d937f7-692a-451a-9643-fe199da6ba03
Meeting URL: https://teams.microsoft.com/l/meetup-join/19%3ameeting_...
🎙️ Transcription provider: openai
🚀 Initializing real-time transcription system...
🤖 Joining Teams meeting with real-time transcription...
✅ Meeting processed with real-time transcription!
🎥 Video link: https://knowledgebasedev.blob.core.windows.net/meeting-joiner/meetings/e4d937f7-692a-451a-9643-fe199da6ba03/video.mp4
📝 Transcript link: https://knowledgebasedev.blob.core.windows.net/meeting-joiner/meetings/e4d937f7-692a-451a-9643-fe199da6ba03/mapped_transcripts.json
🎙️ Real-time stats: 0 chunks processed during meeting
Meeting processing completed: Meeting fully processed with real-time transcription
Video available at: https://knowledgebasedev.blob.core.windows.net/meeting-joiner/meetings/e4d937f7-692a-451a-9643-fe199da6ba03/video.mp4
Transcript available at: https://knowledgebasedev.blob.core.windows.net/meeting-joiner/meetings/e4d937f7-692a-451a-9643-fe199da6ba03/mapped_transcripts.json"""

result = parse_processor_output(test_output)
print("Parsing test results:")
print("====================")
print(f"Video link: {result.get('videoLink')}")
print(f"Transcript link: {result.get('mappedTranscriptLink')}")
print(f"Message: {result.get('message')}")
print("")
print(
    "✅ Success!"
    if result.get("videoLink") and result.get("mappedTranscriptLink")
    else "❌ Failed!"
)
