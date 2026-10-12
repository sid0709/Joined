package ranking

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
)

// LightGBM decision_type bits for a numerical split.
const (
	lgbmCategoricalMask = 1
	lgbmDefaultLeftMask = 2
	lgbmMissingShift    = 2
	lgbmMissingMask     = 3
	lgbmMissingZero     = 1
	lgbmMissingNaN      = 2
	// lgbmZeroThreshold is LightGBM's kZeroThreshold: |v| at or below it counts as zero.
	lgbmZeroThreshold = 1e-35
)

// lgbmTree is one regression tree in LightGBM's array layout: internal node i
// splits on feature[i] at threshold[i]; a child index below zero is leaf ^index.
type lgbmTree struct {
	feature   []int
	threshold []float64
	decision  []int
	left      []int
	right     []int
	leaf      []float64
}

// lgbmModel is a parsed LightGBM text model (format v3 or v4) with numerical
// splits only, which is how train_ltr.py trains: every feature is a number.
type lgbmModel struct {
	features int
	trees    []lgbmTree
}

// parseLGBM reads a LightGBM text model file.
func parseLGBM(path string) (*lgbmModel, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 1<<20), 1<<28)

	model := &lgbmModel{features: -1}
	var tree map[string]string
	finish := func() error {
		if tree == nil {
			return nil
		}
		t, err := buildLGBMTree(tree)
		if err != nil {
			return fmt.Errorf("tree %d: %w", len(model.trees), err)
		}
		model.trees = append(model.trees, t)
		tree = nil
		return nil
	}
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		switch {
		case line == "end of trees":
			if err := finish(); err != nil {
				return nil, err
			}
			return model.validate()
		case strings.HasPrefix(line, "Tree="):
			if err := finish(); err != nil {
				return nil, err
			}
			tree = map[string]string{}
		case line == "":
			if err := finish(); err != nil {
				return nil, err
			}
		default:
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			if tree != nil {
				tree[key] = value
			} else if key == "max_feature_idx" {
				n, err := strconv.Atoi(value)
				if err != nil {
					return nil, fmt.Errorf("max_feature_idx: %w", err)
				}
				model.features = n + 1
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if err := finish(); err != nil {
		return nil, err
	}
	return model.validate()
}

func (m *lgbmModel) validate() (*lgbmModel, error) {
	if m.features < 1 {
		return nil, fmt.Errorf("model has no max_feature_idx")
	}
	if len(m.trees) == 0 {
		return nil, fmt.Errorf("model has no trees")
	}
	return m, nil
}

func buildLGBMTree(fields map[string]string) (lgbmTree, error) {
	leaves, err := strconv.Atoi(fields["num_leaves"])
	if err != nil || leaves < 1 {
		return lgbmTree{}, fmt.Errorf("bad num_leaves %q", fields["num_leaves"])
	}
	if cat, _ := strconv.Atoi(fields["num_cat"]); cat > 0 {
		return lgbmTree{}, fmt.Errorf("categorical splits are not supported")
	}
	t := lgbmTree{}
	if t.leaf, err = parseFloats(fields["leaf_value"]); err != nil || len(t.leaf) != leaves {
		return lgbmTree{}, fmt.Errorf("leaf_value: want %d values (%v)", leaves, err)
	}
	if leaves == 1 {
		return t, nil
	}
	internal := leaves - 1
	if t.feature, err = parseInts(fields["split_feature"]); err != nil || len(t.feature) != internal {
		return lgbmTree{}, fmt.Errorf("split_feature: want %d values (%v)", internal, err)
	}
	if t.threshold, err = parseFloats(fields["threshold"]); err != nil || len(t.threshold) != internal {
		return lgbmTree{}, fmt.Errorf("threshold: want %d values (%v)", internal, err)
	}
	if t.decision, err = parseInts(fields["decision_type"]); err != nil || len(t.decision) != internal {
		return lgbmTree{}, fmt.Errorf("decision_type: want %d values (%v)", internal, err)
	}
	if t.left, err = parseInts(fields["left_child"]); err != nil || len(t.left) != internal {
		return lgbmTree{}, fmt.Errorf("left_child: want %d values (%v)", internal, err)
	}
	if t.right, err = parseInts(fields["right_child"]); err != nil || len(t.right) != internal {
		return lgbmTree{}, fmt.Errorf("right_child: want %d values (%v)", internal, err)
	}
	for _, d := range t.decision {
		if d&lgbmCategoricalMask != 0 {
			return lgbmTree{}, fmt.Errorf("categorical splits are not supported")
		}
	}
	return t, nil
}

// predict is the raw score: the sum of every tree's leaf for row.
func (m *lgbmModel) predict(row []float64) float64 {
	total := 0.0
	for i := range m.trees {
		total += m.trees[i].value(row)
	}
	return total
}

// value walks one tree with LightGBM's numerical decision rule, missing values included.
func (t *lgbmTree) value(row []float64) float64 {
	if len(t.feature) == 0 {
		return t.leaf[0]
	}
	node := 0
	for node >= 0 {
		v := 0.0
		if f := t.feature[node]; f < len(row) {
			v = row[f]
		}
		decision := t.decision[node]
		missing := (decision >> lgbmMissingShift) & lgbmMissingMask
		if math.IsNaN(v) && missing != lgbmMissingNaN {
			v = 0
		}
		var goLeft bool
		if (missing == lgbmMissingZero && math.Abs(v) <= lgbmZeroThreshold) || (missing == lgbmMissingNaN && math.IsNaN(v)) {
			goLeft = decision&lgbmDefaultLeftMask != 0
		} else {
			goLeft = v <= t.threshold[node]
		}
		if goLeft {
			node = t.left[node]
		} else {
			node = t.right[node]
		}
	}
	return t.leaf[^node]
}

func parseFloats(text string) ([]float64, error) {
	fields := strings.Fields(text)
	out := make([]float64, len(fields))
	for i, field := range fields {
		v, err := strconv.ParseFloat(field, 64)
		if err != nil {
			return nil, err
		}
		out[i] = v
	}
	return out, nil
}

func parseInts(text string) ([]int, error) {
	fields := strings.Fields(text)
	out := make([]int, len(fields))
	for i, field := range fields {
		v, err := strconv.Atoi(field)
		if err != nil {
			return nil, err
		}
		out[i] = v
	}
	return out, nil
}
