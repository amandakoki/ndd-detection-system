"""Suggestions shown on the dashboards after a screening.

Have a qualified specialist review the wording before the system is used with real children.
"""

# For the educator
SUPPORT = {
    "High": [
        "Audio-supported reading materials",
        "Extended time on written tasks",
        "Dyslexia-friendly font and spacing",
        "Discuss a follow-up assessment by a specialist with the learner's guardians",
    ],
    "Medium": [
        "Extended time on written tasks",
        "Clear, well-spaced text and audio support where available",
        "Screen again in a few weeks and watch the progress trend",
    ],
    "Low": [
        "No additional support recommended at this time.",
        "Continue routine monitoring.",
    ],
}

# For the guardian
HOME_SUPPORT = {
    "High": [
        "Read together with audio support",
        "Be patient with written homework",
        "Talk to the educator about next steps",
    ],
    "Medium": [
        "Read together for a few minutes each day",
        "Be patient with written homework",
    ],
    "Low": [
        "Keep up regular reading together",
    ],
}

# For the learner (no mention of any result)
LEARNER_CONTENT = {
    "High": {
        "title": "Reading practice with audio narration",
        "reason": "Based on your recent activity, we recommend content with audio narration and larger text spacing.",
    },
    "Medium": {
        "title": "Reading practice with audio narration",
        "reason": "Based on your recent activity, we recommend content with audio narration and larger text spacing.",
    },
}