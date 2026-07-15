# Studioforma Lead Tracker

## What I'm building

A web app that tracks a Studioforma project through one continuous pipeline, from first sales contact all the way to dispatch, using a fixed, manageable stage list instead of Studioforma's current free-text tracking.

## Who it's for or why I chose this

This is for Abhiroop Agarwal, Director at Studioforma. Right now leads and orders live in two disconnected pictures: a Lead Tracker sheet where "Current Stage" is free text (so the same stage gets written a dozen different ways), and a separate production process that starts once an order is won. Parts of both processes get tracked informally over WhatsApp and paper notes rather than in any single tool, which is a sign the current setup does not match how the team actually works. I want Abhiroop to be able to open one tool and see any project's status, whether it is still being chased as a lead or already on the production floor, without needing to interpret what someone meant by "quote sent, following up."

## Core features

1. A form to add a new project and assign it a stage from a managed stage list. The default stage list runs New, Meeting, Quoting, Quoted, Won, Order Received, Material Sourced, In Production, Quality Check, Dispatched, with Lost as a separate terminal state a project can move to from any pre-Won stage.
2. A stage management screen where Abhiroop can rename, reorder, add, or remove stages, since the exact names in use may not match my default list exactly.
3. A form to update an existing project's stage as it moves through the pipeline, with a timestamp recorded on each change.
4. A dashboard view that groups all projects by stage, so Abhiroop can see counts and details at each stage at a glance, from first contact through delivery.
5. Search and filter projects by client name or project type, and data persistence in the browser (localStorage) so it is not lost on refresh.

## What I don't know yet

- The exact stage names Abhiroop actually uses day to day. I am starting from the production tracker's stage names (Order Received, Material Sourced, In Production, Quality Check, Dispatched) plus a standard sales sequence before them (New, Meeting, Quoting, Quoted, Won), but stage management as a feature exists precisely so this does not need to be perfect on day one.
- Whether the In Production stage should keep the Carpentry, Painting, Finishing sub-stages from the production tracker, or whether that level of detail belongs only in the production tool and not in this combined view.
- Whether localStorage is good enough for a real handoff to Abhiroop, since it only lives on one browser on one machine, or whether I should look at Supabase so the data is shared and persists across devices. I am building the localStorage version first and treating a shared backend as a stretch goal if time allows.
- How to handle a project that needs to move backward in the pipeline (for example Quoted back to Quoting if the client asks for a revised quote), and whether that should be a special case or just a normal stage change.
