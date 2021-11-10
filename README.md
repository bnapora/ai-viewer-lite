# ai-viewer-lite  

## Download & Format Test WSI

1. Follow instructions in setup_WSI_DZI.md to download test image to project directory.

## First Time Setup

1. Install [Node.js](http://nodejs.org/) if not already installed
1. Clone the ai-viewer-lite repository
1. From a terminal session, navigate to the repository folder
1. Run `npm install`

## Running lite-server

1. From a terminal session, navigate to the repository folder
1. Run `npm start`

## Debugging (Visual Studio Code)

To run a debugging session in Visual Studio Code, the following .vscode/launch.json configuration can be used:

```javascript
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Site - Microsoft Edge",
      "type": "edge",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Launch Site - Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Launch Site - Firefox",
      "type": "firefox",
      "request": "launch",
      "reAttach": true,
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
      "pathMappings": [
        {
          "url": "http://localhost:3000",
          "path": "${webRoot}/"
        }
      ]
    }
  ]
}
```

1. Start the local server as described in the "Running lite-server" section above
1. Use the Visual Studio Code Run & Debug pane to select a launch configuration
1. Start a debugging session (F5)
