import Group from "../models/Group.js"
import Item from "../models/Item.js";
import LensGroup from "../models/LensGroup.js";
import { logDeletion } from "../utils/logDeletion.js";

const getAllGroups = async (req, res) => {
    try {
        const groupsDb = await Group.find().lean();
        const groups = await Promise.all(groupsDb.map(async (group) => {
            const itemExists = await Item.exists({ groupName: group.groupName });
            const lensGroupExists = await LensGroup.exists({ groupName: group.groupName });
            return {
                ...group,
                canDelete: !itemExists && !lensGroupExists
            };
        }));
        res.status(200).json({ groups });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error !!" });
        console.log(error)
    }
}
const getGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const groups = await Group.findById(id);
        res.status(200).json({ groups });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error !!" });
        console.log(error)
    }
}

const addGroup = async (req, res) => {
    const {
        groupName, date
    } = req.body;
    if (!groupName) {
        return res.status(400).json({ message: "Group Name is required" });
    }
    try {
        const existingGroup = await Group.findOne({ groupName: groupName });
        if (existingGroup) {
            return res.status(400).json({ message: "Group Name already exists" });
        }
        const newGroup = await new Group({
            groupName, date
        })

        await newGroup.save();
        res.status(201).json({ message: "Group added successfully", group: newGroup });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error !!" });
        console.log(error)
    }
}

const updateGroup = async (req, res) => {
    const { id } = req.params;
    console.log("Updating group with id:", id);
    const {
        groupName, date
    } = req.body;
    if (!groupName) {
        return res.status(400).json({ message: "Group Name is required" });
    }
    try {
        const existingGroup = await Group.findOne({ _id: { $ne: id }, groupName: groupName });
        if (existingGroup) {
            return res.status(400).json({ message: "Group Name already exists" });
        }
        const updatedGroup = await Group.findByIdAndUpdate(id, {
            groupName, date
        }, { new: true });
        res.status(200).json({ message: "Group updated successfully", group: updatedGroup });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error !!" });
        console.log(error)
    }
}

const deleteGroup = async (req, res) => {
    const { id } = req.params;

    try {
        const group = await Group.findById(id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check Items
        const itemExists = await Item.findOne({ groupName: group.groupName });
        if (itemExists) {
            return res.status(400).json({ message: "This group cannot be deleted because it contains items." });
        }

        // Check Lens Groups
        const lensGroupExists = await LensGroup.findOne({ groupName: group.groupName });
        if (lensGroupExists) {
            return res.status(400).json({ message: "This group cannot be deleted because it contains lens items." });
        }

        const response = await Group.findByIdAndDelete(id);

        await logDeletion({
            type: "group",
            name: response.groupName,
            originalData: response
        });

        res.status(200).json({ message: "Group deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};



export { getAllGroups, getGroup, addGroup, updateGroup, deleteGroup }