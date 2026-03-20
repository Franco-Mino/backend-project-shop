export class ToggleUserStatusCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly isActive: boolean,
  ) {}
}
