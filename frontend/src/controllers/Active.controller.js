import ApiClient from "../ApiClient";

export const getTopProducts = async()=>{
    try{
        const res = await ApiClient.get('/active/topProducts')
        return res.data
    }
    catch(err){
        console.log(err)
        throw err
    }
}