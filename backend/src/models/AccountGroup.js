import mongoose from "mongoose";
const { Schema } = mongoose;

const AccountGroupSchema = new Schema({
    accountGroupName : { type : String , required : true , min : 1 },
    primaryGroup : {type : String , enum : ['Y' , 'N'] , required : true},
    LedgerGroup : {type : String , required : true}
},{timestamps : true})

const AccountGroup = mongoose.model("AccountGroup", AccountGroupSchema);
export default AccountGroup;
