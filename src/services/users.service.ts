interface IAccountService {
  getUser(userId: string): { userId: string; completionDate: string };
}

class AccountService implements IAccountService {
  getUser(userId: string) {
    // Replace with API call that ideally returns date of onboarding completion
    return { userId, completionDate: 'true' };
  }
}

const accountService = new AccountService() as IAccountService;
export default accountService;
