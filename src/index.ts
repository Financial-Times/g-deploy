/**
 * @file
 * Main entry point for instantiating Deployer
 */

import Deployer, { IDeployerOptions } from "./Deployer";

export default async (
  options: IDeployerOptions,
  eventListeners?: { [key: string]: (...args: any[]) => void }
) => {
  const deployer = new Deployer(options);

  if (eventListeners) {
    Object.keys(eventListeners).forEach((name) => {
      deployer.on(name, eventListeners[name]);
    });
  }

  return deployer.execute();
};

export { Deployer };
