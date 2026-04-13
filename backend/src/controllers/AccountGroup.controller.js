import AccountGroup from "../models/AccountGroup.js";

const addAccountGroup = async (req, res) => {
  try {
    const { accountGroupName, primaryGroup, LedgerGroup } = req.body;

    const existing = await AccountGroup.findOne({
      accountGroupName,
      LedgerGroup,
      primaryGroup,
    });

    if (existing) {
      return res.status(200).json({
        success: false,
        message: "Account Group already exists!",
      });
    }

    const newAccountGroup = new AccountGroup({
      accountGroupName,
      primaryGroup,
      LedgerGroup,
    });
    await newAccountGroup.save();
    return res.status(201).json({
      success: true,
      message: "Account Group added successfully!",
      group: newAccountGroup,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const getAllAccountGroups = async (req, res) => {
  try {
    const accountGroups = await AccountGroup.find();    
    res.status(200).json(accountGroups);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error !!" });
  }
};

const getAccountGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await AccountGroup.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Account Group not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Account Group fetched successfully",
      group,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
};
const updateAccountGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountGroupName, primaryGroup, LedgerGroup } = req.body;

    // Check if the account group exists
    const group = await AccountGroup.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Account Group not found!",
      });
    }
    const existing = await AccountGroup.findOne({
      _id: { $ne: id }, 
      accountGroupName,
      primaryGroup,
      LedgerGroup,
    });

    if (existing) {
      return res.status(200).json({
        success: false,
        message: "Another Account Group with same details already exists!",
      });
    }
    group.accountGroupName = accountGroupName;
    group.primaryGroup = primaryGroup;
    group.LedgerGroup = LedgerGroup;

    await group.save();

    return res.status(200).json({
      success: true,
      message: "Account Group updated successfully!",
      group,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the Account Group!",
    });
  }
};

const deleteAccountGroup = async (req,res)=>{
  try{
    const {id} = req.params;
    const group = await AccountGroup.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Account Group not found!",
      });
    }
    await AccountGroup.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Account Group deleted successfully!",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
}

export { addAccountGroup, getAllAccountGroups, getAccountGroupById, updateAccountGroup, deleteAccountGroup };
