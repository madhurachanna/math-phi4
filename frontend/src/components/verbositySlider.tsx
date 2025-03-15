import React, { useState } from "react";

// Define prop types
interface VerbositySliderProps {
    onLevelChange: (level: number) => void;
}

const verbosityLevels = ["Concise", "Detailed", "Elaborate", "Comprehensive"];

const VerbositySlider: React.FC<VerbositySliderProps> = ({ onLevelChange }) => {
    const [level, setLevel] = useState(1); // Default to 'Detailed'

    const handleLevelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLevel = Number(event.target.value);
        setLevel(newLevel);
        onLevelChange(newLevel); // Notify parent
    };

    return (
        <div className="w-100">
            <label className="f5 db mb2">Select Explanation Level</label>
            <div className="w-100 pa4 bg-dark-gray white br3 ml2">
                <input
                    type="range"
                    min="0"
                    max="3"
                    value={level}
                    onChange={handleLevelChange}
                    className="w-100 slider"
                />
                <div className="tc mt3 f4 og">{verbosityLevels[level]}</div>
            </div>
        </div>
    );
};

export default VerbositySlider;
