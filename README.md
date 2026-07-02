# AKDFA Static Demo Website

This folder contains a premium static live demo for **All Kerala Dhoni Fans Association (AKDFA)**.

It uses only:

- HTML
- CSS
- JavaScript
- Local AKDFA assets

There is no backend, database, real login, real upload system, or real form submission in this demo.

## Files

- `index.html` - public website
- `admin.html` - static admin panel mockup
- `style.css` - shared visual system and responsive layout
- `script.js` - demo interactions
- `assets/akdfa-circle-logo.png` - circle logo
- `assets/akdfa-black-logo.png` - black logo
- `assets/football-tournament.jpg` - event image
- `assets/khel-ratna-post.jpg` - news image

## Open Locally

Open `index.html` directly in a browser.

You can also open `admin.html` directly to view the admin demo.

## Deploy on Netlify

1. Log in to Netlify.
2. Create a new site.
3. Drag and drop the `akdfa-demo` folder into Netlify Drop, or connect a Git repository.
4. Use the folder as a static site. No build command is required.
5. Set the publish directory to `akdfa-demo` if deploying from a larger repository.

## Deploy on Vercel

1. Log in to Vercel.
2. Import the project repository.
3. Set the framework preset to `Other`.
4. Leave the build command empty.
5. Set the output directory to `akdfa-demo` if deploying from a larger repository.
6. Deploy.

## Replace Logos and Content

Replace files inside `assets/` while keeping the same filenames, or update the paths in `index.html` and `admin.html`.

Main logo files:

- `assets/akdfa-circle-logo.png`
- `assets/akdfa-black-logo.png`

Main demo image files:

- `assets/football-tournament.jpg`
- `assets/khel-ratna-post.jpg`

Content is currently hardcoded in `index.html`, `admin.html`, and `script.js` so the demo remains portable.

## Final Development Scope

The following production features are not included in this static demo and can be added during final development:

- Backend application
- PostgreSQL database
- Real admin login
- Image uploads
- Membership request handling
- Contact enquiry handling
- Event management
- News publishing
- Gallery management
- District committee management
- Website settings management
