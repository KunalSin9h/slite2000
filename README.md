<div align="center">
    <img width="128" height="128" alt="image" src="https://github.com/user-attachments/assets/b4ca1fdc-7ca5-4624-8739-8f644d78f576" />
    <h1>Metalite</h1> 
</div>

[![Made at SafeDep](https://github.com/user-attachments/assets/8ab0a2cd-7a34-49f4-8070-ededd3ea58c1)](https://safedep.io)

<div align="center">
<img width="1026" height="811" alt="image" src="https://github.com/user-attachments/assets/649876aa-3645-4cd5-bc36-3c88621ae671" />
</div>

Desktop application for managing and visualizing remote SQLite databases via SSH.</p>

### Features

-   **SSH Tunneling**: Connect securely to any remote server using SSH keys.
-   **Remote Execution**: Run SQLite queries directly on the server; no file syncing required.
-   **Visualization & Distribution** Analysis
-   **Saved Connections**: Store your frequently accessed servers for one-click connection.

### Prerequisites

-   **Local Machine**: Linux, macOS, or Windows.
-   **Remote Server**: Must have `sqlite3` installed and accessible in the system PATH.

### Installation

#### Pre Compiled Binaries

Download `Metalite` from GitHub [Releases](https://github.com/KunalSin9h/metalite/releases).

#### From Source

1.  **Install Go**: Ensure you have Go 1.21+ installed.
2.  **Install Node.js**: Required for the frontend build.
3.  **Install Wails**:
    ```bash
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```
4.  **Clone & Build**:
    ```bash
    git clone https://github.com/KunalSin9h/metalite.git
    cd metalite
    wails build
    ```
    The binary will be available in `build/bin/`.

### Usage

1.  **Launch the App**: Run the generated binary.
2.  **New Connection**:
    -   **Host**: IP address of your remote server (e.g., `1.2.3.4`).
    -   **User**: SSH username (e.g., `ubuntu`).
    -   **SSH Key**: Absolute path to your private key (e.g., `/home/user/.ssh/id_rsa`).
    -   **Database**: Absolute path to the SQLite file on the remote server (e.g., `/var/www/app/db.sqlite`).
3.  **Save**: Click the "Save" icon to store these details for later.
4.  **Connect**: Click "Connect" to open the dashboard.
5.  **Query**: Select a table from the sidebar or type a custom SQL query and click "Run".

### Development

To run the application in development mode with hot-reloading:

```bash
wails dev
```

### License

MIT
