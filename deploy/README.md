# About

This folder contains a minimal set of tooling to continually deploy changes to the latinum library, as and when the sources are being edited locally. The deployment happens to a local folder of your choice.

In case of one time deployment, start the script and then terminate once you get the message that says: "`Watches established`".

# Limitations

The current auto deployment script is crafted to run from within a Linux system. It could be possible to run the same on MacOS after installing the required dependencies with HomeBrew. For Windows, an emulation layer, such as Cygwin, might work.

# Prerequisites

## Apache Ant

Ant is a build tool from [Apache Foundation](https://www.apache.org) and can be downloaded from [here](https://ant.apache.org). It is built on top of Java that must be downloaded separately either from Oracle Corporation, or as an open source product (e.g. OpenJDK).

It recommeded that you use Java version 11 and above. The version of Ant that we recommend is 1.9 and newer.

## iNotify Tools

These are Linux shell utilities to monitor file system events. They are being used internally to track changes in Latinum sources for continuous deployment. You can install these tools using the following command line instruction:

```sudo apt install inotify-tools```

# Running

Make sure the executable flag is set for the file named `autodeploy' and then run the same from a command line:

```
$ chmod +x ./autodeploy
$ ./autodeploy
```

# Configuration

Unless specified, the library is copied into the subfolder named `remote-deploy/shared/latinum` under the current user's home directory. You can change this location by following these steps:

Create a folder named `buildconfigs/latinum` under the current user's home directory.

Create a file named `build.properties` within the above subfolder.

Edit the file to have the following key/value information:

```deploydir = {destination-folder}```

Replace `{destination-folder}` with the absolute deployment path of your choice.