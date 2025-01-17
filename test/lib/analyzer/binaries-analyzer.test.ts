#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741

// tslint:disable:max-line-length
// tslint:disable:object-literal-key-quotes

import * as sinon from "sinon";
import { test } from "tap";

import * as analyzer from "../../../lib/analyzer/binaries-analyzer";
import * as subProcess from "../../../lib/sub-process";

test("analyze", async (t) => {
  const examples = [
    {
      description: "no binaries in image",
      targetImage: "alpine:2.6",
      binariesOutputLines: {
        node: "node: command not found",
        openjdk: "java: command not found",
      },
      installedPackages: [],
      expectedBinaries: [],
    },
    {
      description: "bogus output Node image",
      targetImage: "node:6.15.1",
      binariesOutputLines: {
        node: "bogus.version.1",
        openjdk: "bogus.version.1",
      },
      installedPackages: [],
      expectedBinaries: [],
    },
    {
      description: "Node is in image",
      targetImage: "node:6.15.1",
      binariesOutputLines: {
        node: "v6.15.1",
        openjdk: "java: command not found",
      },
      installedPackages: ["a", "b", "c"],
      expectedBinaries: [{ name: "node", version: "6.15.1" }],
    },
    {
      description: "Node installed by package manager",
      targetImage: "node:6.15.1",
      binariesOutputLines: {
        node: "v6.15.1",
        openjdk: "java: command not found",
      },
      installedPackages: ["node"],
      expectedBinaries: [],
    },
    {
      description: "Node installed by package manager with the name nodejs",
      targetImage: "node:6.15.1",
      binariesOutputLines: {
        node: "v6.15.1",
        openjdk: "java: command not found",
      },
      installedPackages: ["nodejs"],
      expectedBinaries: [],
    },
    {
      description: "no openJDK in image",
      targetImage: "alpine:2.6",
      binariesOutputLines: { node: "", openjdk: "java: command not found" },
      installedPackages: [],
      expectedBinaries: [],
    },
    {
      description: "bogus output openJDK image",
      targetImage: "openjdk:latest",
      binariesOutputLines: { node: "", openjdk: "bogus.version.1" },
      installedPackages: [],
      expectedBinaries: [],
    },
    {
      description: "openJDK is in image",
      targetImage: "openjdk:latest",
      binariesOutputLines: {
        node: "",
        openjdk: `java version "1.8.0_191"
                                       Java(TM) SE Runtime Environment (build 1.8.0_191-b12)
                                       Java HotSpot(TM) 64-Bit Server VM (build 25.191-b12, mixed mode)`,
      },
      installedPackages: ["a", "b", "c"],
      expectedBinaries: [{ name: "openjdk-jre", version: "1.8.0_191-b12" }],
    },
    {
      description: "openJDK installed by package manager",
      targetImage: "node:6.15.1",
      binariesOutputLines: {
        node: "",
        openjdk: `java version "1.8.0_191"
                                       Java(TM) SE Runtime Environment (build 1.8.0_191-b12)
                                       Java HotSpot(TM) 64-Bit Server VM (build 25.191-b12, mixed mode)`,
      },
      installedPackages: ["openjdk-8-jre-headless"],
      expectedBinaries: [],
    },
    {
      description: "openJDK and Node present in image",
      targetImage: "node:6.15.1",
      binariesOutputLines: {
        node: "v6.15.1",
        openjdk: `java version "1.8.0_191"
                                       Java(TM) SE Runtime Environment (build 1.8.0_191-b12)
                                       Java HotSpot(TM) 64-Bit Server VM (build 25.191-b12, mixed mode)`,
      },
      installedPackages: [],
      expectedBinaries: [
        { name: "node", version: "6.15.1" },
        { name: "openjdk-jre", version: "1.8.0_191-b12" },
      ],
    },
    {
      description: "adoptopenjdk version with hyphen in image",
      targetImage: "adoptopenjdk/openjdk10",
      binariesOutputLines: {
        node: "",
        openjdk: `Picked up JAVA_TOOL_OPTIONS: -XX:+UseContainerSupport
                                       openjdk 10.0.2-adoptopenjdk 2018-07-17
                                       OpenJDK Runtime Environment (build 10.0.2-adoptopenjdk+13)
                                       OpenJDK 64-Bit Server VM (build 10.0.2-adoptopenjdk+13, mixed mode)`,
      },
      installedPackages: [],
      expectedBinaries: [
        { name: "openjdk-jre", version: "10.0.2-adoptopenjdk+13" },
      ],
    },
    {
      description: "adoptopenjdk version without hyphen in image",
      targetImage: "adoptopenjdk/openjdk11",
      binariesOutputLines: {
        node: "",
        openjdk: `Picked up JAVA_TOOL_OPTIONS: -XX:+UseContainerSupport
                                       openjdk 11.0.2 2019-01-15
                                       OpenJDK Runtime Environment AdoptOpenJDK (build 11.0.2+9)
                                       OpenJDK 64-Bit Server VM AdoptOpenJDK (build 11.0.2+9, mixed mode)`,
      },
      installedPackages: [],
      expectedBinaries: [{ name: "openjdk-jre", version: "11.0.2+9" }],
    },
  ];

  for (const example of examples) {
    await t.test(example.description, async (t) => {
      const execStub = sinon.stub(subProcess, "execute");
      execStub
        .withArgs("docker", [
          "run",
          "--rm",
          "--entrypoint",
          '""',
          "--network",
          "none",
          sinon.match.any,
          "node",
          "--version",
        ])
        .resolves({ stdout: example.binariesOutputLines.node, stderr: "" });

      execStub
        .withArgs("docker", [
          "run",
          "--rm",
          "--entrypoint",
          '""',
          "--network",
          "none",
          sinon.match.any,
          "java",
          "-version",
        ])
        .resolves({ stdout: example.binariesOutputLines.openjdk, stderr: "" });

      t.teardown(() => execStub.restore());

      const { targetImage, installedPackages, expectedBinaries } = example;
      const actual = await analyzer.analyze(
        targetImage,
        installedPackages,
        "apt",
      );

      t.same(actual, {
        Image: targetImage,
        AnalyzeType: "binaries",
        Analysis: expectedBinaries,
      });
    });
  }
});
