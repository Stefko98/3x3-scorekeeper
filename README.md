# CourtFlow 3x3 Organizator

## Pokretanje na Linuxu

Na glavnom Linux racunaru, iz foldera `3x3 Basket`, pokreni:

```bash
bash "Pokreni aplikaciju Linux.sh"
```

Skripta automatski:

- proverava Node.js 20.9 ili noviji
- po potrebi preuzima lokalni Node.js runtime bez menjanja sistema
- instalira Linux pakete aplikacije
- pravi produkcioni build
- pokrece server na `0.0.0.0:3000`
- prikazuje adresu za sporedni laptop

Na sporednom Linux laptopu pokreni:

```bash
bash "Otvori na sporednom laptopu Linux.sh"
```

Za direktno prosledjivanje IP adrese glavnog racunara:

```bash
bash "Otvori na sporednom laptopu Linux.sh" 192.168.1.5
```

Oba racunara moraju biti na istoj Wi-Fi ili hotspot mrezi.

Za pokretanje dvoklikom prvo jednom dozvoli izvrsavanje:

```bash
chmod +x "Pokreni aplikaciju Linux.sh"
chmod +x "Otvori na sporednom laptopu Linux.sh"
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
