# MEDCNET (Vercel)

1. Ordner in ein GitHub-Repo pushen und bei Vercel importieren (Framework: "Other").
2. Umgebungsvariablen aus `.env.example` in Vercel eintragen (MONGODB_URI, JWT_SECRET, SETUP_KEY, Discord-Werte).
3. Ersten Admin anlegen (einmalig):
   curl -X POST https://DEINE-DOMAIN/api/setup -H "Content-Type: application/json" \
     -d '{"key":"SETUP_KEY","dienstnummer":"1000","name":"Admin","password":"mindestens8zeichen"}'
4. Anmelden, unter "Benutzer" Konten anlegen und bei Bedarf die Discord-ID eintragen.
5. Discord: Redirect-URI im Developer Portal = DISCORD_REDIRECT_URI.

Enthalten: Login (Dienstnummer), Rollen, Benutzerverwaltung, Fahrzeug-CRUD (Funkkanal, Besatzung, Status, Tank), Einsätze mit automatischer Einsatznummer (E-JJJJ-000001), Live-Übersicht, Suche, Protokolle, Discord-Login, /api/health.
Noch nicht enthalten: Patientennummer, Rechnungsvorlagen, Dienstplan, Chat, 2FA – gern als nächster Schritt.
